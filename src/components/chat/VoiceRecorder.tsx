import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Alert, TouchableOpacity, Vibration, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, type RecordingOptions } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

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

const LEVEL_BARS = 22;
const LOCK_DY = 70;      // slide UP this far → hands-free
const CANCEL_DX = 90;    // slide SIDEWAYS this far → throw the take away

/**
 * The gesture every student already knows (founder, 2026-09-20: "like WhatsApp"):
 *
 *   hold  → record, with the clock running and the level moving with your voice
 *   lift  → send
 *   slide sideways → cancel (the bar turns red first, so it is never a surprise)
 *   slide up → LOCK: let go, keep talking, then tap send — or the bin
 *
 * The cap comes from the server (§8); recording stops itself at the limit. The clip is
 * handed to the parent, which uploads it through the same door as any other attachment —
 * so a muted student's recording is refused exactly like their typing.
 */
export function VoiceRecorder({ maxSeconds, disabled, onClip, onStateChange }: {
  maxSeconds: number;
  disabled?: boolean;
  onClip: (clip: VoiceClip) => void;
  onStateChange?: (recording: boolean) => void;
}) {
  const { t } = useTranslation();
  const { width: winWidth } = useWindowDimensions();
  const recorder = useAudioRecorder(VOICE_PRESET);
  const state = useAudioRecorderState(recorder, 200);
  const [active, setActive] = useState(false);     // recording (held or locked)
  const [locked, setLocked] = useState(false);
  const [cancelArmed, setCancelArmed] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => Array(LEVEL_BARS).fill(0.08));
  const start = useRef({ x: 0, y: 0 });
  const cancelRef = useRef(false);
  const lockedRef = useRef(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishing = useRef(false);

  const seconds = Math.round((state.durationMillis || 0) / 1000);

  useEffect(() => { onStateChange?.(active); }, [active, onStateChange]);

  // The level trail: metering is dB (−160 … 0); speech sits around −30 … −10.
  useEffect(() => {
    if (!active) return;
    const db = typeof state.metering === 'number' ? state.metering : -60;
    const amp = Math.max(0.08, Math.min(1, (db + 50) / 45));
    setLevels((prev) => [...prev.slice(1), amp]);
  }, [state.metering, state.durationMillis, active]);

  const begin = async (e: GestureResponderEvent) => {
    if (disabled || active) return;
    start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    cancelRef.current = false; lockedRef.current = false; finishing.current = false;
    setCancelArmed(false); setLocked(false);
    setLevels(Array(LEVEL_BARS).fill(0.08));
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert('', t('chat.mic_denied')); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      Vibration.vibrate(15);
      setActive(true);
      // Hard stop at the cap, then send whatever was captured.
      stopTimer.current = setTimeout(() => { void finish(false); }, maxSeconds * 1000);
    } catch {
      Alert.alert('', t('chat.mic_denied'));
    }
  };

  const move = (e: GestureResponderEvent) => {
    if (!active || lockedRef.current) return;
    const dy = start.current.y - e.nativeEvent.pageY;
    const dx = Math.abs(e.nativeEvent.pageX - start.current.x);
    if (dy > LOCK_DY && dx < CANCEL_DX) {
      lockedRef.current = true; setLocked(true); setCancelArmed(false); cancelRef.current = false;
      Vibration.vibrate(10);
      return;
    }
    const armed = dx > CANCEL_DX;
    if (armed !== cancelRef.current) { cancelRef.current = armed; setCancelArmed(armed); }
  };

  const release = () => {
    if (!active || lockedRef.current) return; // locked: the buttons decide
    void finish(cancelRef.current);
  };

  const finish = async (cancel: boolean) => {
    if (finishing.current) return;
    finishing.current = true;
    if (stopTimer.current) { clearTimeout(stopTimer.current); stopTimer.current = null; }
    setActive(false); setLocked(false); setCancelArmed(false);
    let uri: string | null = null;
    const dur = Math.round((recorder.currentTime || state.durationMillis / 1000 || 0));
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch { /* ignore */ }
    try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch { /* ignore */ }

    if (cancel || !uri) return;
    if (dur < 1) { Alert.alert('', t('chat.recording_too_short')); return; }
    const ext = uri.split('.').pop()?.toLowerCase() || 'm4a';
    const mime = ext === 'm4a' || ext === 'mp4' ? 'audio/mp4' : ext === 'caf' ? 'audio/x-caf' : ext === '3gp' ? 'audio/3gpp' : ext === 'webm' ? 'audio/webm' : 'audio/mp4';
    onClip({ uri, duration: Math.min(dur, maxSeconds), mime, name: `voice.${ext}` });
  };

  // The live bar takes the field's place: the recorder is the row's last child (the LEFT
  // edge under forced RTL), so the bar runs from just past the button to the far edge.
  const barLeft = 52 + spacing.sm;
  const barWidth = Math.max(160, winWidth - spacing.md * 2 - barLeft);
  const tint = cancelArmed ? colors.danger : colors.textPrimary;

  return (
    <View style={{ alignItems: 'center' }}>
      {active ? (
        <View
          pointerEvents={locked ? 'auto' : 'none'}
          style={{
            position: 'absolute', bottom: 0, left: barLeft, width: barWidth, height: 52,
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md,
            borderRadius: radius.lg, borderWidth: 1,
            backgroundColor: cancelArmed ? colors.dangerLight : colors.surfaceSunken,
            borderColor: cancelArmed ? colors.danger : colors.borderStrong,
          }}
        >
          {locked ? (
            <TouchableOpacity onPress={() => { void finish(true); }} accessibilityRole="button" accessibilityLabel={t('common.cancel')} hitSlop={8} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="trash" size={20} color={colors.danger} outline />
            </TouchableOpacity>
          ) : null}
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, opacity: seconds % 2 === 0 ? 1 : 0.35 }} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: tint, minWidth: 40, writingDirection: 'ltr' }}>
            {`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}
          </Text>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 28 }}>
            {levels.map((a, i) => (
              <View key={i} style={{ flex: 1, height: Math.max(3, Math.round(a * 26)), borderRadius: 2, backgroundColor: cancelArmed ? colors.danger : colors.brand, opacity: 0.45 + 0.55 * (i / LEVEL_BARS) }} />
            ))}
          </View>
          {locked ? (
            <TouchableOpacity onPress={() => { void finish(false); }} accessibilityRole="button" accessibilityLabel={t('chat.send')} hitSlop={8} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="send" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: cancelArmed ? colors.dangerText : colors.textTertiary, maxWidth: 110, textAlign: 'right' }}>
              {cancelArmed ? t('common.cancel') : t('chat.recording_cancel')}
            </Text>
          )}
        </View>
      ) : null}
      <Pressable
        onPressIn={begin}
        onTouchMove={move}
        onPressOut={release}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('chat.voice_note')}
        accessibilityHint={t('chat.record_hint')}
        style={{
          width: 52, height: 52, borderRadius: radius.lg,
          backgroundColor: active ? (cancelArmed ? colors.danger : colors.brand) : (disabled ? colors.border : colors.brand),
          alignItems: 'center', justifyContent: 'center',
          transform: [{ scale: active && !locked ? 1.12 : 1 }],
        }}
      >
        <Icon name={locked ? 'lock' : 'mic'} size={22} color={disabled && !active ? colors.textTertiary : '#fff'} />
      </Pressable>
    </View>
  );
}
