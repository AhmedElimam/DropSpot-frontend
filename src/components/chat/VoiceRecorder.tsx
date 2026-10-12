import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, Alert, I18nManager, AccessibilityInfo } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, Extrapolation, FadeIn, FadeOut, ZoomIn, cancelAnimation, interpolate, runOnJS,
  useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import {
  useAudioRecorder, RecordingPresets, getRecordingPermissionsAsync, requestRecordingPermissionsAsync,
  setAudioModeAsync, type RecordingOptions,
} from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { attachmentFileName } from '@/api/chat';
import { haptic } from '@/utils/haptics';

export interface VoiceClip {
  uri: string;
  /** Seconds, rounded. */
  duration: number;
  mime: string;
  name: string;
}

/**
 * Speech, not music: AAC, one channel, 32 kbit/s. A minute is ~240 KB and uploads in a
 * second on a phone; the stock HIGH_QUALITY preset (128 kbit/s stereo) was four times that
 * for nothing a voice note needs. Metering on, so the live level can move with the voice.
 */
const VOICE_PRESET: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
};

const BTN = 52;
const LEVEL_BARS = 26;
const MIN_LEVEL = 0.1;
/** Slide this far toward the bar → the take is thrown away, at once (no need to let go). */
export const CANCEL_DX = 110;
/** Slide this far up → locked: let go and keep talking. */
export const LOCK_DY = 80;
/** A touch shorter than this is a tap, not a recording: it shows the hint instead. */
export const TAP_MS = 300;
const TICK_MS = 90;
const SPRING = { damping: 18, stiffness: 260, mass: 0.6 };

export type RecorderPhase = 'idle' | 'holding' | 'locked' | 'cancelled';

/**
 * Which way a slide goes, decided per touch like WhatsApp: whichever axis leads wins, so a
 * slightly diagonal drag never half-cancels and half-locks. Pure — tested without a phone.
 * `towardCancel` is the finger's distance toward the bar (already signed for RTL).
 */
export function slideIntent(towardCancel: number, up: number): { slide: number; lift: number; action: 'none' | 'cancel' | 'lock' } {
  'worklet'; // called from the pan gesture on the UI thread
  const toward = Math.max(0, towardCancel);
  const rise = Math.max(0, up);
  if (rise > toward) return { slide: 0, lift: rise, action: rise > LOCK_DY ? 'lock' : 'none' };
  return { slide: toward, lift: 0, action: toward > CANCEL_DX ? 'cancel' : 'none' };
}

/** The live level from the recorder's metering (dB, −160 … 0; speech sits near −30 … −10). */
export function levelFromDb(db: number | undefined | null): number {
  const v = typeof db === 'number' && Number.isFinite(db) ? db : -60;
  return Math.max(MIN_LEVEL, Math.min(1, (v + 52) / 44));
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The gesture every student already knows (founder 2026-10-12: «doesn't work on hold, doesn't
 * swipe to cancel, doesn't feel smooth like WhatsApp»):
 *
 *   hold        → record at once: a tap of haptics, the button grows under the finger, the
 *                 clock runs and the level moves with the voice
 *   let go      → send
 *   slide to the bar → the take is thrown away the moment it crosses the line
 *   slide up    → LOCK: let go, keep talking, then tap send — or the bin
 *   a quick tap → nothing is sent; a hint says to hold
 *
 * Why it failed before: the button was a Pressable, which ends a press the moment the finger
 * leaves its hit box — so sliding 20 px to cancel or lock fired "release" and SENT the clip.
 * And a press that ended while the microphone was still starting left it recording with no
 * finger on it. This is one native pan gesture that never ends on leaving the button
 * (`shouldCancelWhenOutside(false)`), tracked on the UI thread so the button and the
 * «slide to cancel» label follow the finger at the screen's frame rate; and a release
 * before the microphone is ready waits for it and then decides.
 *
 * A hook, not a component: the composer places the running BAR over its text field (which
 * stays mounted, so an open keyboard does not drop and shift the button mid-hold) and the
 * BUTTON at the end of its row.
 */
export function useVoiceRecorder({ maxSeconds, disabled, onClip, onStateChange }: {
  maxSeconds: number;
  disabled?: boolean;
  onClip: (clip: VoiceClip) => void;
  onStateChange?: (recording: boolean) => void;
}): { active: boolean; bar: ReactNode; button: ReactNode } {
  const { t } = useTranslation();
  const recorder = useAudioRecorder(VOICE_PRESET);
  const [phase, setPhaseState] = useState<RecorderPhase>('idle');
  const phaseRef = useRef<RecorderPhase>('idle');
  const setPhase = useCallback((p: RecorderPhase) => { phaseRef.current = p; setPhaseState(p); }, []);
  const [ms, setMs] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(LEVEL_BARS).fill(MIN_LEVEL));
  const [hint, setHint] = useState<string | null>(null);

  const permitted = useRef<boolean | null>(null);
  const starting = useRef<Promise<boolean> | null>(null);
  const pressedAt = useRef(0);
  const recordStartedAt = useRef(0);
  const finishing = useRef(false);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disabledRef = useRef(!!disabled);
  disabledRef.current = !!disabled;

  // UI-thread state: the finger's travel, the button's growth, and two flags the gesture reads.
  const slide = useSharedValue(0);
  const lift = useSharedValue(0);
  const grow = useSharedValue(0);
  const live = useSharedValue(0);
  const resolved = useSharedValue(0);
  const blink = useSharedValue(1);

  // Knowing the permission before the first hold means the first hold records.
  useEffect(() => {
    getRecordingPermissionsAsync().then((p) => { permitted.current = p.granted; }).catch(() => undefined);
  }, []);

  const recording = phase === 'holding' || phase === 'locked';
  useEffect(() => { onStateChange?.(phase !== 'idle'); }, [phase, onStateChange]);

  // The red dot breathes while recording — and only then (no idle loops).
  useEffect(() => {
    if (recording) {
      blink.value = withRepeat(withSequence(withTiming(0.25, { duration: 520 }), withTiming(1, { duration: 520 })), -1);
    } else {
      cancelAnimation(blink);
      blink.value = 1;
    }
  }, [recording, blink]);

  // Clock + level, read straight from the recorder while it records.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      let st: ReturnType<typeof recorder.getStatus> | null = null;
      try { st = recorder.getStatus(); } catch { return; }
      if (!st?.isRecording) return;
      setMs(st.durationMillis || Date.now() - recordStartedAt.current);
      setLevels((prev) => [...prev.slice(1), levelFromDb(st?.metering)]);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [recording, recorder]);

  const showHint = useCallback((key: string) => {
    setHint(t(key));
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 2200);
  }, [t]);

  const finish = useCallback(async (mode: 'send' | 'cancel') => {
    const current = phaseRef.current;
    if (finishing.current || current === 'idle' || current === 'cancelled') return;
    finishing.current = true;
    live.value = 0;
    if (capTimer.current) { clearTimeout(capTimer.current); capTimer.current = null; }
    const held = Date.now() - pressedAt.current;
    const wasLocked = current === 'locked';

    // The screen answers at once; the recorder catches up behind it.
    if (mode === 'cancel') {
      haptic('warning');
      setPhase('cancelled');
      AccessibilityInfo.announceForAccessibility(t('chat.recording_cancelled'));
      setTimeout(() => { if (phaseRef.current === 'cancelled') setPhase('idle'); }, CANCEL_ANIM_MS);
    } else {
      setPhase('idle');
    }

    const ok = await (starting.current ?? Promise.resolve(false));
    starting.current = null;
    let uri: string | null = null;
    let seconds = 0;
    if (ok) {
      try { seconds = (recorder.getStatus().durationMillis || 0) / 1000; } catch { /* below */ }
      if (!seconds && recordStartedAt.current) seconds = (Date.now() - recordStartedAt.current) / 1000;
      try { await recorder.stop(); uri = recorder.uri; } catch { /* nothing to send */ }
    }
    try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch { /* ignore */ }
    finishing.current = false;

    if (mode === 'cancel' || !uri) return;
    if (!wasLocked && held < TAP_MS) { showHint('chat.record_hint'); return; }
    if (seconds < 1) { showHint('chat.recording_too_short'); return; }
    haptic('light');
    const ext = uri.split('.').pop()?.toLowerCase() || 'm4a';
    const mime = ext === 'm4a' || ext === 'mp4' ? 'audio/mp4' : ext === 'caf' ? 'audio/x-caf' : ext === '3gp' ? 'audio/3gpp' : ext === 'webm' ? 'audio/webm' : 'audio/mp4';
    onClip({ uri, duration: Math.max(1, Math.min(Math.round(seconds), maxSeconds)), mime, name: attachmentFileName('voice', null, ext) });
  }, [live, maxSeconds, onClip, recorder, setPhase, showHint, t]);

  const begin = useCallback((lockAtOnce = false) => {
    // A new touch while still «holding» means the last release never arrived: show the
    // locked controls (send / bin) instead of letting this touch's release send it.
    if (phaseRef.current === 'holding') { haptic('medium'); setPhase('locked'); return; }
    if (disabledRef.current || phaseRef.current !== 'idle' || finishing.current) return;
    if (permitted.current !== true) {
      // The system prompt takes the touch away: ask, and let the next hold record.
      requestRecordingPermissionsAsync()
        .then((p) => { permitted.current = p.granted; if (!p.granted) Alert.alert('', t('chat.mic_denied')); })
        .catch(() => Alert.alert('', t('chat.mic_denied')));
      return;
    }
    pressedAt.current = Date.now();
    recordStartedAt.current = 0;
    setMs(0);
    setLevels(Array(LEVEL_BARS).fill(MIN_LEVEL));
    setHint(null);
    setPhase(lockAtOnce ? 'locked' : 'holding');
    live.value = lockAtOnce ? 0 : 1;
    haptic('light');
    starting.current = (async () => {
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        recordStartedAt.current = Date.now();
        return true;
      } catch {
        return false;
      }
    })();
    void starting.current.then((ok) => {
      if (!ok && phaseRef.current !== 'idle' && !finishing.current) {
        live.value = 0;
        setPhase('idle');
        Alert.alert('', t('chat.mic_denied'));
      }
    });
    // Hard stop at the server's cap, then send what was captured.
    capTimer.current = setTimeout(() => { void finish('send'); }, maxSeconds * 1000 + 250);
  }, [finish, live, maxSeconds, recorder, setPhase, t]);

  const lock = useCallback(() => {
    if (phaseRef.current !== 'holding') return;
    haptic('medium');
    setPhase('locked');
  }, [setPhase]);

  // Stable entry points for the gesture worklets (they are built once, below).
  const api = useRef({ begin, finish, lock });
  api.current = { begin, finish, lock };
  const onBegin = useCallback(() => api.current.begin(false), []);
  const onRelease = useCallback(() => { if (phaseRef.current === 'holding') void api.current.finish('send'); }, []);
  const onCancel = useCallback(() => { void api.current.finish('cancel'); }, []);
  const onLock = useCallback(() => api.current.lock(), []);
  // The system took the touch away (a call, a system gesture): keep what was recorded and
  // show send / bin — never send on the system's behalf.
  const onInterrupted = useCallback(() => { if (phaseRef.current === 'holding') api.current.lock(); }, []);

  // Leaving the screen mid-recording throws the take away rather than leaving the mic open.
  useEffect(() => () => {
    if (capTimer.current) clearTimeout(capTimer.current);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    if (phaseRef.current === 'holding' || phaseRef.current === 'locked') {
      try { void recorder.stop(); } catch { /* ignore */ }
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    }
  }, [recorder]);

  // RTL: the button sits at the LEFT edge and the bar runs to its right, so "toward the bar"
  // is +x; in LTR it is −x. Transforms are physical, so the same sign moves the button.
  const dir = I18nManager.isRTL ? 1 : -1;

  // Raw touches, not a pan's state machine: the finger going down starts it, THAT finger
  // lifting sends it, and nothing in between can swallow the lift (founder 2026-10-12: «I
  // don't have to hold it … there's a bug» — a release lost on a still finger left the mic
  // recording until the next tap sent it).
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pointer = useSharedValue(-1);
  const gesture = useMemo(() => Gesture.Manual()
    .enabled(!disabled)
    .hitSlop(8)
    .onTouchesDown((e, manager) => {
      if (e.changedTouches.length === 0) return;
      // A second finger is ignored — but a lone finger is always ours, even if a lost lift
      // left the last pointer on record.
      if (pointer.value !== -1 && e.allTouches.length > 1) return;
      const tp = e.changedTouches[0];
      pointer.value = tp.id;
      startX.value = tp.absoluteX;
      startY.value = tp.absoluteY;
      resolved.value = 0;
      manager.activate();
      grow.value = withSpring(1, SPRING);
      runOnJS(onBegin)();
    })
    .onTouchesMove((e) => {
      if (live.value !== 1 || resolved.value === 1) return;
      let x = -1;
      let y = -1;
      for (const tp of e.allTouches) {
        if (tp.id === pointer.value) { x = tp.absoluteX; y = tp.absoluteY; }
      }
      if (x < 0) return;
      const intent = slideIntent((x - startX.value) * dir, startY.value - y);
      slide.value = Math.min(intent.slide, CANCEL_DX + 20);
      lift.value = Math.min(intent.lift, LOCK_DY + 20);
      if (intent.action !== 'none') {
        resolved.value = 1;
        slide.value = withSpring(0, SPRING);
        lift.value = withSpring(0, SPRING);
        grow.value = withSpring(0, SPRING);
        runOnJS(intent.action === 'cancel' ? onCancel : onLock)();
      }
    })
    .onTouchesUp((e, manager) => {
      let ours = false;
      for (const tp of e.changedTouches) {
        if (tp.id === pointer.value) ours = true;
      }
      if (!ours) return;
      pointer.value = -1;
      slide.value = withSpring(0, SPRING);
      lift.value = withSpring(0, SPRING);
      grow.value = withSpring(0, SPRING);
      if (resolved.value === 0) {
        resolved.value = 1;
        runOnJS(onRelease)();
      }
      manager.end();
    })
    .onTouchesCancelled((_e, manager) => {
      pointer.value = -1;
      slide.value = withSpring(0, SPRING);
      lift.value = withSpring(0, SPRING);
      grow.value = withSpring(0, SPRING);
      if (resolved.value === 0) {
        resolved.value = 1;
        runOnJS(onInterrupted)();
      }
      manager.fail();
    })
    .onFinalize(() => {
      // Belt and braces: whatever ended the gesture, a finger still on record is released.
      if (pointer.value !== -1) {
        pointer.value = -1;
        grow.value = withSpring(0, SPRING);
        if (resolved.value === 0) {
          resolved.value = 1;
          runOnJS(onInterrupted)();
        }
      }
    }), [disabled, dir, grow, lift, live, onBegin, onCancel, onInterrupted, onLock, onRelease, pointer, resolved, slide, startX, startY]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: slide.value * dir },
      { translateY: -lift.value },
      { scale: interpolate(grow.value, [0, 1], [1, 1.32], Extrapolation.CLAMP) },
    ],
  }));
  const lockStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 0.55 }],
  }));
  const lockChevronStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lift.value, [0, LOCK_DY * 0.8], [1, 0], Extrapolation.CLAMP),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(slide.value, [0, CANCEL_DX * 0.85], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: slide.value * dir * 0.7 }],
  }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  // ── The bar (drawn by the composer over its field) ────────────────────────────────────
  let bar: ReactNode = null;
  if (phase === 'cancelled') {
    bar = (
      <Animated.View entering={FadeIn.duration(90)} exiting={FadeOut.duration(160)} style={barShell()} accessibilityLabel={t('chat.recording_cancelled')}>
        <CancelBin />
      </Animated.View>
    );
  } else if (recording) {
    bar = (
      <Animated.View entering={FadeIn.duration(110)} exiting={FadeOut.duration(120)} style={barShell()}>
        {phase === 'locked' ? (
          <TouchableOpacity onPress={() => { void finish('cancel'); }} accessibilityRole="button" accessibilityLabel={t('chat.recording_discard')} hitSlop={10} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trash" size={21} color={colors.danger} outline />
          </TouchableOpacity>
        ) : null}
        <Animated.View style={[{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger }, dotStyle]} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, minWidth: 42, writingDirection: 'ltr' }}>{fmt(ms)}</Text>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 28, overflow: 'hidden' }}>
          {levels.map((a, i) => (
            <View key={i} style={{ flex: 1, height: Math.max(3, Math.round(a * 26)), borderRadius: 2, backgroundColor: colors.brand, opacity: 0.35 + 0.65 * (i / LEVEL_BARS) }} />
          ))}
        </View>
        {phase === 'holding' ? (
          <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 2 }, labelStyle]}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{t('chat.slide_to_cancel')}</Text>
            <Icon name={I18nManager.isRTL ? 'forward' : 'back'} size={14} color={colors.textSecondary} />
          </Animated.View>
        ) : null}
      </Animated.View>
    );
  }

  // ── The button (the end of the composer's row) ────────────────────────────────────────
  const button = (
    <View style={{ width: BTN, height: BTN, zIndex: 2 }}>
      {phase === 'holding' ? (
        <Animated.View pointerEvents="none" entering={FadeIn.duration(140)} exiting={FadeOut.duration(100)} style={[{ position: 'absolute', bottom: BTN + 14, left: 0, right: 0, alignItems: 'center' }, lockStyle]}>
          <View style={{ width: 40, paddingVertical: 10, borderRadius: 20, alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadows.md }}>
            <Icon name="lock" size={18} color={colors.textSecondary} outline />
            <Animated.View style={lockChevronStyle}><Icon name="up" size={16} color={colors.textTertiary} /></Animated.View>
          </View>
        </Animated.View>
      ) : null}

      {hint ? (
        <Animated.View pointerEvents="none" entering={FadeIn.duration(140)} exiting={FadeOut.duration(200)} style={{ position: 'absolute', bottom: BTN + 12, end: 0, width: 236, backgroundColor: colors.textPrimary, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12, ...shadows.md }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 19, color: colors.background, textAlign: 'right' }}>{hint}</Text>
        </Animated.View>
      ) : null}

      {phase === 'locked' ? (
        <Animated.View entering={ZoomIn.duration(160)}>
          <TouchableOpacity
            onPress={() => { void finish('send'); }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('chat.send')}
            style={{ width: BTN, height: BTN, borderRadius: BTN / 2, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...shadows.sm }}
          >
            <Icon name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <GestureDetector gesture={gesture}>
          <Animated.View
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('chat.voice_note')}
            accessibilityHint={t('chat.record_hint')}
            // A screen-reader user cannot hold and slide: activating starts a LOCKED recording.
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={() => begin(true)}
            style={[{
              width: BTN, height: BTN, borderRadius: phase === 'holding' ? BTN / 2 : radius.lg,
              backgroundColor: disabled ? colors.border : colors.brand,
              alignItems: 'center', justifyContent: 'center',
            }, buttonStyle]}
          >
            <Icon name="mic" size={22} color={disabled ? colors.textTertiary : '#fff'} />
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );

  return { active: phase !== 'idle', bar, button };
}

function barShell() {
  return {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.borderStrong,
  };
}

/** How long the bin plays before the field comes back. */
const CANCEL_ANIM_MS = 900;

/**
 * The take thrown away, said with a picture instead of words (founder 2026-10-12): the
 * bin pops up where the red dot was, the mic drops into it spinning, the lid rattles, and
 * the bin sinks away.
 */
function CancelBin() {
  const bin = useSharedValue(0);
  const mic = useSharedValue(0);
  const lid = useSharedValue(0);
  const away = useSharedValue(0);
  useEffect(() => {
    bin.value = withSpring(1, { damping: 11, stiffness: 320 });
    mic.value = withDelay(70, withTiming(1, { duration: 340, easing: Easing.in(Easing.quad) }));
    lid.value = withDelay(400, withSequence(withTiming(1, { duration: 80 }), withTiming(-1, { duration: 90 }), withTiming(0, { duration: 80 })));
    away.value = withDelay(660, withTiming(1, { duration: 200, easing: Easing.in(Easing.cubic) }));
  }, [bin, mic, lid, away]);
  const binStyle = useAnimatedStyle(() => ({
    opacity: bin.value * (1 - away.value),
    transform: [
      { translateY: away.value * 22 },
      { scale: interpolate(bin.value, [0, 1], [0.3, 1], Extrapolation.CLAMP) },
      { rotate: `${lid.value * 14}deg` },
    ],
  }));
  const micStyle = useAnimatedStyle(() => ({
    opacity: interpolate(mic.value, [0, 0.85, 1], [1, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(mic.value, [0, 1], [-38, 2]) },
      { scale: interpolate(mic.value, [0, 1], [1.05, 0.5]) },
      { rotate: `${mic.value * 220}deg` },
    ],
  }));
  return (
    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={binStyle}><Icon name="trash" size={25} color={colors.danger} /></Animated.View>
      <Animated.View style={[{ position: 'absolute' }, micStyle]}><Icon name="mic" size={18} color={colors.danger} /></Animated.View>
    </View>
  );
}
