import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, I18nManager } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useFrameCallback, useSharedValue, withSpring } from 'react-native-reanimated';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { audioModeIs, ensureAudioMode } from '@/chat/audioMode';
import { File, Paths } from 'expo-file-system';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { chat, waveform } from '@/theme/chat';
import { Icon } from '@/components/ui/Icon';
import { claimVoicePlayback, cycleVoiceRate, getVoiceRate, onVoiceRate, playNextVoiceAfter, registerVoiceNote } from '@/components/chat/voiceQueue';

const WAVE_H = 32;
const THUMB = 13;
/** How often the player reports its position; the UI thread fills the frames in between. */
const STATUS_MS = 100;

/**
 * Where a touch on the waveform lands, as a fraction of the clip. Under RTL the first bar is
 * on the RIGHT, so the distance from the right edge is progress. Runs on the UI thread.
 */
export function fractionAtX(x: number, width: number, rtl: boolean): number {
  'worklet';
  if (width <= 0) return 0;
  const f = Math.max(0, Math.min(1, x / width));
  return rtl ? 1 - f : f;
}

/**
 * Where the playhead is right now, between two player reports: the last reported position
 * plus the time since, at the playing rate — so the fill glides instead of stepping four
 * times a second. Runs on the UI thread.
 */
/**
 * The playhead's next anchor from a player report — never a visible step back
 * (founder 2026-10-12: «when it plays the dot sits back for a second»).
 *
 * A report is a sample taken a moment before it arrives, so the glide is usually a little
 * AHEAD of it; snapping to it stepped the dot back several times a second. Small gaps are
 * absorbed (forward catches up at once, backward holds the dot until the audio passes it);
 * a large gap is a real jump (a seek, a stall) and is taken as reported. Before the audio
 * has actually started moving after play, the dot does not move at all. Pure — tested.
 */
export function nextAnchor(reportedSec: number, shownSec: number, projectedSec: number, moving: boolean): number {
  if (!moving) return reportedSec;
  if (Math.abs(reportedSec - projectedSec) > 0.6) return reportedSec;
  return Math.max(reportedSec, shownSec);
}

export function projectedProgress(anchorSec: number, anchorAtMs: number, nowMs: number, rate: number, totalSec: number): number {
  'worklet';
  if (totalSec <= 0) return 0;
  const pos = anchorSec + (Math.max(0, nowMs - anchorAtMs) / 1000) * rate;
  return Math.max(0, Math.min(1, pos / totalSec));
}

/**
 * A voice note, drawn as a voice note — and behaving like one (WhatsApp is the bar).
 *
 * Smoothness (founder 2026-10-12: «selecting a minute isn't smooth, there's a delay on hold
 * and hearing the exact moment; the playing chart isn't smooth»):
 *  - the fill and the playhead dot are drawn on the UI thread: the player reports its
 *    position every 250 ms and a frame callback glides between reports — only while this
 *    note plays, so nothing ticks for a note at rest;
 *  - the fill is ONE clipped layer of lit bars over the dim ones, so it moves by the pixel,
 *    not bar by bar;
 *  - scrubbing is a native gesture: the dot follows the finger on the UI thread with no
 *    React render per move; on release the player seeks with zero tolerance (the exact
 *    moment, not the nearest keyframe) and carries on playing if it was;
 *  - a tap anywhere on the waveform jumps there.
 *
 * The clip is fetched into the app cache with our headers (token, staging key) and played
 * from disk — seeks on a local file are instant. A clip just recorded is already local.
 * The waveform is derived from the message id (stable per message, no decoding).
 */
export function VoiceNote({ url, headers, duration, mine, seed }: {
  url: string;
  headers: Record<string, string>;
  duration: number;
  mine: boolean;
  /** The message id — waveform seed AND the note's place in the room's play order. */
  seed: number;
}) {
  const [localUri, setLocalUri] = useState<string | null>(url.startsWith('file:') ? url : null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (url.startsWith('file:')) { setLocalUri(url); return; }
    let alive = true;
    (async () => {
      try {
        const dest = new File(Paths.cache, `voice-${Math.abs(seed)}.m4a`);
        if (!dest.exists || (dest.size ?? 0) === 0) {
          try { if (dest.exists) dest.delete(); } catch { /* best effort */ }
          await File.downloadFileAsync(url, dest, { headers });
        }
        if (alive) { setLocalUri(dest.uri); setFetchFailed(false); }
      } catch {
        if (alive) setFetchFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [url, seed, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const player = useAudioPlayer(localUri ? { uri: localUri } : null, { updateInterval: STATUS_MS });
  const status = useAudioPlayerStatus(player);
  const bars = useMemo(() => waveform(seed), [seed]);
  const [rate, setRate] = useState(getVoiceRate());
  const [played, setPlayed] = useState(false);
  const [scrubSec, setScrubSec] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const playedRef = useRef(false);
  const wasPlaying = useRef(false);
  const rtl = I18nManager.isRTL;

  const total = status.duration > 0 ? status.duration : duration;

  // UI-thread playhead.
  const progress = useSharedValue(0);
  const anchorSec = useSharedValue(0);
  const anchorAt = useSharedValue(0);
  const rateSV = useSharedValue(rate);
  const totalSV = useSharedValue(total);
  const widthSV = useSharedValue(0);
  const scrubbing = useSharedValue(0);
  // 0 from «play» until the player's position has actually advanced: the audio session takes a
  // beat to start, and a dot that glides through that beat has to snap back afterwards.
  const moving = useSharedValue(0);
  const startSec = useRef(0);
  const playingSeen = useRef(false);
  const thumbScale = useSharedValue(1);
  const lastLabelAt = useSharedValue(0);

  useEffect(() => { totalSV.value = total; }, [total, totalSV]);
  useEffect(() => { rateSV.value = rate; }, [rate, rateSV]);

  const glide = useFrameCallback(() => {
    if (scrubbing.value === 1 || moving.value === 0) return;
    progress.value = projectedProgress(anchorSec.value, anchorAt.value, Date.now(), rateSV.value, totalSV.value);
  }, false);

  // Every player report re-anchors the glide — forward freely, never back over a small gap;
  // at rest the playhead sits exactly on the report.
  useEffect(() => {
    const now = Date.now();
    const reported = status.currentTime;
    if (!status.playing) {
      playingSeen.current = false;
      moving.value = 0;
      anchorSec.value = reported;
      anchorAt.value = now;
      if (scrubbing.value === 0) progress.value = total > 0 ? Math.min(1, reported / total) : 0;
      return;
    }
    if (!playingSeen.current) { playingSeen.current = true; startSec.current = reported; }
    if (moving.value === 0 && reported > startSec.current + 0.02) moving.value = 1;
    const projected = anchorSec.value + ((now - anchorAt.value) / 1000) * rateSV.value;
    anchorSec.value = nextAnchor(reported, progress.value * total, projected, moving.value === 1);
    anchorAt.value = now;
  }, [status.currentTime, status.playing, total, anchorSec, anchorAt, progress, scrubbing, moving, rateSV]);
  useEffect(() => { glide.setActive(!!status.playing); }, [status.playing, glide]);
  useEffect(() => () => glide.setActive(false), [glide]);

  useEffect(() => onVoiceRate(setRate), []);
  useEffect(() => { try { player.setPlaybackRate(rate, 'high'); } catch { /* ignore */ } }, [rate, player]);

  /**
   * Start NOW. The loudspeaker mode (the silent switch must not swallow a note a child tapped)
   * is set once for the room, not by every note as it appears — and when it is already set,
   * play() is called in the same tick as the tap. The rate is only touched when it is not 1×.
   */
  const startPlayer = useCallback(() => {
    const go = () => {
      try {
        const r = getVoiceRate();
        if (r !== 1 || player.playbackRate !== 1) player.setPlaybackRate(r, 'high');
        player.play();
      } catch { /* ignore */ }
    };
    if (audioModeIs('playback')) go();
    else void ensureAudioMode('playback').then(go);
  }, [player]);
  const [wantPlay, setWantPlay] = useState(false);
  const play = useCallback(() => {
    claimVoicePlayback(seed);
    if (!localUri) { setWantPlay(true); return; } // still fetching: start the moment it lands
    startPlayer();
  }, [localUri, seed, startPlayer]);
  useEffect(() => {
    if (wantPlay && localUri) { setWantPlay(false); startPlayer(); }
  }, [wantPlay, localUri, startPlayer]);
  const pause = useCallback(() => { try { player.pause(); } catch { /* ignore */ } }, [player]);

  // In the room's choir for as long as this bubble is on screen.
  const choir = useRef({ play, pause });
  choir.current = { play, pause };
  useEffect(() => registerVoiceNote(seed, { play: () => choir.current.play(), pause: () => choir.current.pause(), played: () => playedRef.current }), [seed]);

  useEffect(() => {
    if (status.didJustFinish) {
      try { void player.seekTo(0); player.pause(); } catch { /* ignore */ }
      progress.value = 0;
      playedRef.current = true;
      setPlayed(true);
      playNextVoiceAfter(seed);
    }
  }, [status.didJustFinish, player, seed, progress]);

  const toggle = () => {
    if (fetchFailed) { setFetchFailed(false); setLocalUri(null); setWantPlay(true); setAttempt((n) => n + 1); return; }
    if (status.playing) pause(); else play();
  };

  // ── Scrubbing ─────────────────────────────────────────────────────────────────────────
  const onScrubStart = useCallback(() => {
    wasPlaying.current = !!status.playing;
    if (status.playing) pause();
  }, [status.playing, pause]);
  const onScrubLabel = useCallback((f: number) => setScrubSec(f * total), [total]);
  const seekTo = useCallback(async (f: number, resume: boolean) => {
    const sec = Math.max(0, Math.min(total, f * total));
    setScrubSec(null);
    anchorSec.value = sec;
    anchorAt.value = Date.now();
    progress.value = total > 0 ? sec / total : 0;
    // From the new place, glide only once the audio is moving again.
    moving.value = 0;
    startSec.current = sec;
    try {
      // Zero tolerance: the exact moment the dot is on, not the nearest keyframe.
      await player.seekTo(sec, 0, 0);
    } catch { /* ignore */ }
    scrubbing.value = 0;
    if (resume) play();
  }, [anchorAt, anchorSec, play, player, progress, scrubbing, total, moving]);
  const onScrubEnd = useCallback((f: number) => { void seekTo(f, wasPlaying.current); }, [seekTo]);
  const onTapSeek = useCallback((f: number) => { void seekTo(f, !!status.playing); }, [seekTo, status.playing]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-4, 4])
      .failOffsetY([-14, 14])
      .onStart((e) => {
        scrubbing.value = 1;
        thumbScale.value = withSpring(1.45, { damping: 14, stiffness: 300 });
        progress.value = fractionAtX(e.x, widthSV.value, rtl);
        runOnJS(onScrubStart)();
      })
      .onUpdate((e) => {
        const f = fractionAtX(e.x, widthSV.value, rtl);
        progress.value = f;
        // The clock under the dot, ten times a second — not a React render per pixel.
        const now = Date.now();
        if (now - lastLabelAt.value > 100) { lastLabelAt.value = now; runOnJS(onScrubLabel)(f); }
      })
      .onEnd(() => { runOnJS(onScrubEnd)(progress.value); })
      .onFinalize(() => { thumbScale.value = withSpring(1, { damping: 14, stiffness: 300 }); });
    const tap = Gesture.Tap()
      .maxDuration(300)
      .onEnd((e, ok) => {
        if (!ok) return;
        const f = fractionAtX(e.x, widthSV.value, rtl);
        scrubbing.value = 1;
        progress.value = f;
        runOnJS(onTapSeek)(f);
      });
    return Gesture.Race(pan, tap);
  }, [lastLabelAt, onScrubEnd, onScrubLabel, onScrubStart, onTapSeek, progress, rtl, scrubbing, thumbScale, widthSV]);

  const fillStyle = useAnimatedStyle(() => ({ width: progress.value * widthSV.value }));
  // Transforms are physical: under RTL the dot travels LEFT from the right edge.
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (rtl ? -1 : 1) * (progress.value * widthSV.value - THUMB / 2) },
      { scale: thumbScale.value },
    ],
  }));

  const fg = mine ? '#fff' : colors.brand;
  const trackOff = mine ? 'rgba(255,255,255,0.34)' : colors.borderStrong;
  const showClock = scrubSec ?? (status.playing || status.currentTime > 0 ? status.currentTime : total);
  const loading = (!localUri && !fetchFailed && wantPlay) || (!status.isLoaded && status.playing);

  const barRow = (color: string) => (
    <View style={{ width: width || undefined, flex: width ? undefined : 1, height: WAVE_H, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {bars.map((h, i) => (
        <View key={i} style={{ flex: 1, height: Math.max(4, Math.round(h * 24)), borderRadius: 2, backgroundColor: color }} />
      ))}
    </View>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 232, paddingVertical: 2 }}>
      <TouchableOpacity
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'إيقاف مؤقت' : 'تشغيل'}
        style={{
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: mine ? 'rgba(255,255,255,0.2)' : colors.brandTint,
          alignItems: 'center', justifyContent: 'center',
          opacity: played && !status.playing ? 0.6 : 1,
        }}
      >
        {loading ? <ActivityIndicator size="small" color={fg} /> : (
          <Icon name={fetchFailed ? 'refresh' : status.playing ? 'pause' : 'play'} size={17} color={fg} />
        )}
      </TouchableOpacity>

      {/* The waveform is the scrubber: tap to jump, drag to scrub. */}
      <GestureDetector gesture={gesture}>
        <View
          onLayout={(e) => { const w = Math.max(1, e.nativeEvent.layout.width); widthSV.value = w; setWidth(w); }}
          accessibilityRole="adjustable"
          accessibilityLabel="موضع التشغيل"
          style={{ flex: 1, height: WAVE_H, justifyContent: 'center' }}
        >
          {barRow(trackOff)}
          {/* The lit bars, clipped to the playhead from the start edge. */}
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, start: 0, overflow: 'hidden', alignItems: 'flex-start' }, fillStyle]}>
            {barRow(fg)}
          </Animated.View>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', start: 0, top: (WAVE_H - THUMB) / 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: fg }, thumbStyle]} />
        </View>
      </GestureDetector>

      {status.playing || rate !== 1 ? (
        <TouchableOpacity
          onPress={() => setRate(cycleVoiceRate())}
          accessibilityRole="button"
          accessibilityLabel="سرعة التشغيل"
          hitSlop={8}
          style={{ paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10, backgroundColor: mine ? 'rgba(255,255,255,0.2)' : colors.surfaceSunken, minWidth: 34, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: mine ? '#fff' : colors.textSecondary, writingDirection: 'ltr' }}>{rate === 1 ? '1×' : `${rate}×`}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: mine ? chat.metaOnMine : colors.textTertiary, minWidth: 32, textAlign: 'left', writingDirection: 'ltr' }}>
          {fmt(showClock)}
        </Text>
      )}
    </View>
  );
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
