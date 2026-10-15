import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { AppModal as Modal } from '@/ui/AppModal';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { videoFrame } from '@/lib/drosMedia';
import type { VideoSource } from './useVideoDraft';
import { clampRange, filmstripTimes, formatClock, initialRange, type TrimRange } from './videoTrim';

const INK = '#0B0F1F';
const HANDLE_W = 18;
const STRIP_H = 58;
const ACCENT = '#F4B740';

/**
 * The trim screen — WhatsApp's, made simple (founder 2026-10-15: «a crop tool of video in app
 * like WhatsApp, an easy one»). The clip on top (tap = play / pause the kept piece only), a
 * filmstrip with two handles under it, the kept length against the limit, «تم» / «إلغاء».
 *
 * The timeline runs left → right even though the app is RTL: media timelines are not mirrored
 * (Material + Apple guidance; the phone's own players do the same), so the strip sits in a
 * `direction: 'ltr'` box and the handles move with plain translateX.
 *
 * The handles live on the UI thread (Reanimated shared values + RNGH pans, clamped by the same
 * `clampRange` the tests cover); React only hears about a drag when it ends, and the length
 * label re-renders once per whole second of change — never per frame.
 */
export function VideoTrimEditor({ editing, maxSeconds, onCancel, onDone }: {
  editing: { source: VideoSource; range: TrimRange | null } | null;
  maxSeconds: number;
  onCancel: () => void;
  onDone: (source: VideoSource, range: TrimRange) => void;
}) {
  return (
    <Modal visible={!!editing} animationType="slide" onRequestClose={onCancel} statusBarTranslucent presentationStyle="fullScreen">
      {editing ? (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: INK }}>
          <EditorBody source={editing.source} initial={editing.range} maxSeconds={maxSeconds} onCancel={onCancel} onDone={onDone} />
        </GestureHandlerRootView>
      ) : null}
    </Modal>
  );
}

function EditorBody({ source, initial, maxSeconds, onCancel, onDone }: {
  source: VideoSource;
  initial: TrimRange | null;
  maxSeconds: number;
  onCancel: () => void;
  onDone: (source: VideoSource, range: TrimRange) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [duration, setDuration] = useState(source.duration);
  const [range, setRange] = useState<TrimRange | null>(() => (source.duration > 0 ? (initial ?? initialRange(source.duration, maxSeconds)) : null));
  const [playing, setPlaying] = useState(false);
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const player = useVideoPlayer({ uri: source.uri }, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.2;
  });

  // The picker did not say how long it is → the player does, once it has loaded.
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay' && !(duration > 0) && player.duration > 0) {
      setDuration(player.duration);
      setRange(initial ?? initialRange(player.duration, maxSeconds));
    }
  });
  useEventListener(player, 'playingChange', ({ isPlaying }) => setPlaying(isPlaying));

  const stripW = Math.max(120, width - spacing.lg * 2 - HANDLE_W * 2);
  const playhead = useSharedValue(-1);

  // Play only the kept piece: stop at its end and wind back to its start.
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const r = rangeRef.current;
    if (!r || !(duration > 0)) return;
    playhead.value = (currentTime / duration) * stripW;
    if (currentTime >= r.end - 0.05) {
      player.pause();
      player.currentTime = r.start;
    }
  });

  const togglePlay = () => {
    const r = rangeRef.current;
    if (!r) return;
    if (player.playing) {
      player.pause();
      return;
    }
    if (player.currentTime < r.start || player.currentTime >= r.end - 0.1) player.currentTime = r.start;
    player.play();
  };

  const onRangeCommit = useCallback((next: TrimRange, moved: 'start' | 'end') => {
    setRange(next);
    // Show the frame the handle stopped on, like WhatsApp.
    player.pause();
    player.currentTime = moved === 'start' ? next.start : Math.max(next.start, next.end - 0.5);
  }, [player]);

  const over = source.duration > maxSeconds;

  return (
    <View style={{ flex: 1 }}>
      {/* Header — close on the start side, the title, the limit */}
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TouchableOpacity onPress={onCancel} accessibilityLabel={t('common.cancel')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff', textAlign: 'right' }}>{t('threads.trim_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: over ? ACCENT : 'rgba(255,255,255,0.65)', textAlign: 'right' }}>
            {over ? t('threads.trim_over', { max: formatClock(maxSeconds) }) : t('threads.trim_hint')}
          </Text>
        </View>
      </View>

      {/* The clip — tap to play / pause the kept piece */}
      <Pressable onPress={togglePlay} style={{ flex: 1, margin: spacing.md, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' }} accessibilityRole="button" accessibilityLabel={playing ? t('threads.trim_pause') : t('threads.trim_play')}>
        <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls={false} allowsFullscreen={false} allowsPictureInPicture={false} />
        {!playing ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="play" size={30} color="#fff" style={{ marginStart: 3 }} />
            </View>
          </View>
        ) : null}
      </Pressable>

      {/* Timeline + the length + the two buttons */}
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.md, gap: spacing.md }}>
        {range && duration > 0 ? (
          <Timeline
            uri={source.uri}
            duration={duration}
            maxSeconds={maxSeconds}
            stripW={stripW}
            range={range}
            playhead={playhead}
            onCommit={onRangeCommit}
          />
        ) : (
          <View style={{ height: STRIP_H + 40, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#fff" />
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity onPress={onCancel} activeOpacity={0.85} style={{ flex: 1, height: 52, borderRadius: radius.lg, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: '#fff' }}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { if (range) { player.pause(); onDone(duration > 0 && duration !== source.duration ? { ...source, duration } : source, range); } }}
            disabled={!range}
            activeOpacity={0.85}
            style={{ flex: 2, height: 52, borderRadius: radius.lg, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: range ? 1 : 0.5 }}
          >
            <Icon name="check" size={20} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: '#fff' }}>{t('threads.trim_done')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/**
 * The filmstrip and its two handles. Positions are pixels from the strip's left edge
 * (time 0); seconds = px / pps.
 */
function Timeline({ uri, duration, maxSeconds, stripW, range, playhead, onCommit }: {
  uri: string;
  duration: number;
  maxSeconds: number;
  stripW: number;
  range: TrimRange;
  playhead: SharedValue<number>;
  onCommit: (range: TrimRange, moved: 'start' | 'end') => void;
}) {
  const { t } = useTranslation();
  const pps = stripW / duration;
  const startX = useSharedValue(range.start * pps);
  const endX = useSharedValue(range.end * pps);
  const origin = useSharedValue(0);

  // A new range from outside (the duration arrived late) → move the handles there.
  useEffect(() => {
    startX.value = range.start * pps;
    endX.value = range.end * pps;
  }, [range.start, range.end, pps]); // eslint-disable-line react-hooks/exhaustive-deps

  const gestures = useMemo(() => {
    const commit = (s: number, e: number, moved: 'start' | 'end') => onCommit({ start: s, end: e }, moved);
    const handle = (moving: 'start' | 'end') => Gesture.Pan()
      .hitSlop({ horizontal: 14, vertical: 12 })
      .minDistance(0)
      .onBegin(() => {
        origin.value = moving === 'start' ? startX.value : endX.value;
      })
      .onUpdate((e) => {
        const at = (origin.value + e.translationX) / pps;
        const next = clampRange(
          moving === 'start' ? { start: at, end: endX.value / pps } : { start: startX.value / pps, end: at },
          duration, maxSeconds, moving,
        );
        startX.value = next.start * pps;
        endX.value = next.end * pps;
      })
      .onFinalize(() => {
        runOnJS(commit)(startX.value / pps, endX.value / pps, moving);
      });
    return { start: handle('start'), end: handle('end') };
  }, [pps, duration, maxSeconds, onCommit]); // eslint-disable-line react-hooks/exhaustive-deps

  const dimStart = useAnimatedStyle(() => ({ width: HANDLE_W + startX.value }));
  const dimEnd = useAnimatedStyle(() => ({ transform: [{ translateX: HANDLE_W + endX.value }], width: Math.max(0, stripW + HANDLE_W - endX.value) }));
  const frame = useAnimatedStyle(() => ({ transform: [{ translateX: startX.value }], width: endX.value - startX.value + HANDLE_W * 2 }));
  const startHandle = useAnimatedStyle(() => ({ transform: [{ translateX: startX.value }] }));
  const endHandle = useAnimatedStyle(() => ({ transform: [{ translateX: HANDLE_W + endX.value }] }));
  const head = useAnimatedStyle(() => ({
    opacity: playhead.value >= startX.value && playhead.value <= endX.value ? 1 : 0,
    transform: [{ translateX: HANDLE_W + playhead.value - 1 }],
  }));

  const fullW = stripW + HANDLE_W * 2;
  const absolute = { position: 'absolute' as const, top: 0, height: STRIP_H };

  return (
    <View style={{ gap: spacing.sm }}>
      <LengthLabel startX={startX} endX={endX} pps={pps} maxSeconds={maxSeconds} initial={range.end - range.start} />
      {/* LTR on purpose: media timelines are not mirrored. */}
      <View style={{ direction: 'ltr', width: fullW, height: STRIP_H, alignSelf: 'center', alignItems: 'flex-start' }} accessibilityLabel={t('threads.trim_hint')}>
        <View style={[absolute, { transform: [{ translateX: HANDLE_W }], width: stripW, borderRadius: 6, overflow: 'hidden', backgroundColor: '#1B2240' }]}>
          <Filmstrip uri={uri} duration={duration} width={stripW} />
        </View>
        <Animated.View pointerEvents="none" style={[absolute, { backgroundColor: 'rgba(11,15,31,0.72)' }, dimStart]} />
        <Animated.View pointerEvents="none" style={[absolute, { backgroundColor: 'rgba(11,15,31,0.72)' }, dimEnd]} />
        <Animated.View pointerEvents="none" style={[absolute, { borderTopWidth: 3, borderBottomWidth: 3, borderColor: ACCENT, borderRadius: 8 }, frame]} />
        <Animated.View pointerEvents="none" style={[absolute, { width: 2, backgroundColor: '#fff' }, head]} />
        <GestureDetector gesture={gestures.start}>
          <Animated.View style={[absolute, { width: HANDLE_W, borderTopLeftRadius: 8, borderBottomLeftRadius: 8, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }, startHandle]}>
            <View style={{ width: 3, height: 20, borderRadius: 2, backgroundColor: INK }} />
          </Animated.View>
        </GestureDetector>
        <GestureDetector gesture={gestures.end}>
          <Animated.View style={[absolute, { width: HANDLE_W, borderTopRightRadius: 8, borderBottomRightRadius: 8, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }, endHandle]}>
            <View style={{ width: 3, height: 20, borderRadius: 2, backgroundColor: INK }} />
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

/** «٠:٣٢ / الحد ٥:٠٠» — re-renders only when the whole-second length changes. */
function LengthLabel({ startX, endX, pps, maxSeconds, initial }: { startX: SharedValue<number>; endX: SharedValue<number>; pps: number; maxSeconds: number; initial: number }) {
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(Math.round(initial));
  useAnimatedReaction(
    () => Math.round((endX.value - startX.value) / pps),
    (now, before) => { if (now !== before) runOnJS(setSeconds)(now); },
    [pps],
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
      <Icon name="cut" size={16} color={ACCENT} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>
        {t('threads.trim_length', { length: formatClock(seconds), max: formatClock(maxSeconds) })}
      </Text>
    </View>
  );
}

/** Frames along the clip, filled in one by one as the phone grabs them. */
const Filmstrip = memo(function Filmstrip({ uri, duration, width }: { uri: string; duration: number; width: number }) {
  const count = Math.max(6, Math.min(12, Math.round(width / 34)));
  const [frames, setFrames] = useState<(string | null)[]>(() => Array(count).fill(null));

  useEffect(() => {
    let alive = true;
    setFrames(Array(count).fill(null));
    (async () => {
      const times = filmstripTimes(duration, count);
      for (let i = 0; i < times.length && alive; i++) {
        const f = await videoFrame(uri, times[i], 0.3);
        if (!alive) return;
        if (f) setFrames((prev) => { const next = prev.slice(); next[i] = f.uri; return next; });
      }
    })();
    return () => { alive = false; };
  }, [uri, duration, count]);

  const tileW = width / count;
  return (
    <View style={{ flexDirection: 'row', width, height: STRIP_H }}>
      {frames.map((f, i) => (
        <View key={i} style={{ width: tileW, height: STRIP_H, backgroundColor: i % 2 ? '#222A4D' : '#1B2240' }}>
          {f ? <Image source={{ uri: f }} style={{ width: tileW, height: STRIP_H }} contentFit="cover" /> : null}
        </View>
      ))}
    </View>
  );
});
