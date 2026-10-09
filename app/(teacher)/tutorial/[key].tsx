import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, I18nManager, Platform, AppState, ScrollView, useWindowDimensions, type LayoutChangeEvent, type GestureResponderEvent } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StatusBar } from 'expo-status-bar';
import { usePreventScreenCapture, enableAppSwitcherProtectionAsync, disableAppSwitcherProtectionAsync } from 'expo-screen-capture';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, Extrapolation } from 'react-native-reanimated';
import { fonts } from '@/theme/typography';
import { spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { SheetModal } from '@/components/ui/SheetModal';
import { formatNumber } from '@/utils/format';
import { useTutorials } from '@/hooks/useTutorials';
import type { Tutorial } from '@/api/tutorials';

/**
 * One «شروحات» chapter, played the way TikTok plays a video (founder 2026-10-09: «in-video
 * controls similar to TikTok, and dismiss with a swipe down»):
 *
 *   - the video fills the screen and everything floats over it;
 *   - one tap anywhere pauses or resumes (a big ▶ waits in the middle while paused);
 *   - a column on the side: the speed (1x → 1.5x → 2x) and «محطات الشرح»;
 *   - at the bottom corner the title, and the moment Madam Rose is on, like a caption;
 *   - a hairline timeline along the bottom edge, a tick at every «محطة»; a finger on it
 *     thickens it, hides the rest and shows the time big in the middle while you scrub;
 *   - drag the video down and it follows the finger, shrinks, and lets the screen behind show
 *     through; let go far enough (or fast enough) and it closes, otherwise it springs back.
 *
 * Secured on the phone as well as on the server (the stream is AES-128 with a per-viewer key):
 * screenshots and recordings are blocked while this screen is open (black on Android, hidden
 * on iOS), the app switcher shows a blur, no AirPlay/casting or picture-in-picture, playback
 * stops when the app leaves the screen. (No watermark — founder 2026-10-09.)
 */
const SPEEDS = [1, 1.5, 2] as const;
const GOLD = '#C9A227';
const CLOCK = (s: number) => `${formatNumber(Math.floor(Math.max(0, s) / 60))}:${formatNumber(Math.floor(Math.max(0, s) % 60), { minimumIntegerDigits: 2 })}`;
const SHADOW = { textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } } as const;

export default function TutorialPlayer() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { data, isLoading } = useTutorials();
  const chapter = (data ?? []).find((c) => c.key === key) ?? null;

  // Nothing on this screen may be captured: screenshots and recordings come out black/hidden.
  usePreventScreenCapture('tutorial');
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void enableAppSwitcherProtectionAsync(0.9).catch(() => {});
    return () => { void disableAppSwitcherProtectionAsync().catch(() => {}); };
  }, []);

  // Swipe down to close: the video follows the finger and shrinks; the black behind it fades.
  const drop = useSharedValue(0);
  const close = () => router.back();
  const swipe = Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetX([-24, 24])
    .onUpdate((e) => { drop.value = Math.max(0, e.translationY); })
    .onEnd((e) => {
      if (drop.value > 140 || e.velocityY > 900) {
        drop.value = withTiming(height, { duration: 220 }, () => runOnJS(close)());
      } else {
        drop.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });
  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(drop.value, [0, height * 0.6], [1, 0], Extrapolation.CLAMP) }));
  const card = useAnimatedStyle(() => {
    const k = interpolate(drop.value, [0, height], [1, 0.72], Extrapolation.CLAMP);
    return { transform: [{ translateY: drop.value }, { scale: k }], borderRadius: interpolate(drop.value, [0, 120], [0, 28], Extrapolation.CLAMP) };
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#000' }, backdrop]} />
      <GestureDetector gesture={swipe}>
        <Animated.View style={[{ flex: 1, overflow: 'hidden', backgroundColor: '#000' }, card]}>
          {chapter ? (
            <Player chapter={chapter} insets={insets} onClose={close} />
          ) : (
            <View style={{ flex: 1, paddingTop: insets.top }}>
              <CloseButton onPress={close} top={insets.top} label={t('common.close')} />
              {isLoading ? <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: spacing.xxl * 2 }} /> : (
                <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
                  <EmptyState icon="play" title={t('tutorials.missing')} message={t('tutorials.empty_hint')} />
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

function Player({ chapter, insets, onClose }: { chapter: Tutorial; insets: { top: number; bottom: number }; onClose: () => void }) {
  const { t } = useTranslation();
  // The chapter streams ENCRYPTED (AES-128 HLS, a per-viewer key from the server); its link
  // carries no «.m3u8», so the player is told what it is.
  const player = useVideoPlayer(chapter.hls ? { uri: chapter.url, contentType: 'hls' } : chapter.url, (p) => {
    p.muted = false;
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
    p.allowsExternalPlayback = false; // no AirPlay
    p.play();
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { currentTime } = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const [rate, setRate] = useState<number>(1);
  const [showMoments, setShowMoments] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null); // 0…1 while a finger is on the timeline
  const duration = player.duration > 0 ? player.duration : (chapter.seconds ?? 0);
  const moments = chapter.moments ?? [];
  const nowIndex = useMemo(() => {
    let i = -1;
    moments.forEach((m, j) => { if (m.t <= currentTime + 0.3) i = j; });
    return i;
  }, [moments, currentTime]);

  // Leaving the screen, or the app, stops it; nothing keeps playing behind.
  useEffect(() => () => { try { player.pause(); } catch { /* released */ } }, [player]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') { try { player.pause(); } catch { /* released */ } } });
    return () => sub.remove();
  }, [player]);

  const ended = duration > 0 && currentTime >= duration - 0.4;
  const toggle = () => {
    if (isPlaying) player.pause();
    else { if (ended) player.currentTime = 0; player.play(); }
  };
  const seekTo = (s: number) => {
    player.currentTime = Math.max(0, Math.min(duration - 0.2, s));
    if (!isPlaying) player.play();
  };
  const nextSpeed = () => {
    const r = SPEEDS[(SPEEDS.indexOf(rate as (typeof SPEEDS)[number]) + 1) % SPEEDS.length];
    player.playbackRate = r;
    setRate(r);
  };
  const tap = Gesture.Tap().maxDuration(260).onEnd(() => runOnJS(toggle)());
  const scrubbing = scrub !== null;

  return (
    <View style={{ flex: 1 }}>
      <VideoView player={player} nativeControls={false} contentFit="contain" allowsFullscreen={false}
        allowsPictureInPicture={false} startsPictureInPictureAutomatically={false}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />

      {/* One tap anywhere on the picture: pause / resume. */}
      <GestureDetector gesture={tap}>
        <View accessible accessibilityRole="button" accessibilityLabel={isPlaying ? t('tutorials.pause') : t('tutorials.play')}
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
          {!isPlaying && !scrubbing ? (
            <View pointerEvents="none" style={{ opacity: 0.85 }}>
              <Icon name={ended ? 'refresh' : 'play'} size={80} color="rgba(255,255,255,0.85)" />
            </View>
          ) : null}
        </View>
      </GestureDetector>

      {/* While scrubbing: the time, big, in the middle — and nothing else in the way. */}
      {scrubbing ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 34, color: '#FFFFFF', writingDirection: 'ltr', ...SHADOW }}>
            {CLOCK(scrub * duration)}<Text style={{ color: 'rgba(255,255,255,0.6)' }}>{`  /  ${CLOCK(duration)}`}</Text>
          </Text>
        </View>
      ) : null}

      {!scrubbing ? (
        <>
          {/* The grabber says «pull me down»; the ✕ does the same for those who prefer a button. */}
          <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 6, alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' }} />
          <CloseButton onPress={onClose} top={insets.top} label={t('common.close')} />

          {/* The side column, TikTok's like/comment/share place: speed and the moments. */}
          <View style={{ position: 'absolute', end: 12, bottom: insets.bottom + 120, alignItems: 'center', gap: 22 }}>
            <SideButton label={t('tutorials.speed')} onPress={nextSpeed}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: rate === 1 ? '#FFFFFF' : GOLD, writingDirection: 'ltr' }}>{`${rate}x`}</Text>
            </SideButton>
            {moments.length ? (
              <SideButton label={t('tutorials.moments_short')} onPress={() => setShowMoments(true)}>
                <Icon name="list" size={24} color="#FFFFFF" />
              </SideButton>
            ) : null}
          </View>

          {/* The caption corner: what this is, and what Madam Rose is explaining right now. */}
          <TouchableOpacity activeOpacity={0.8} onPress={() => moments.length && setShowMoments(true)}
            style={{ position: 'absolute', start: 16, end: 84, bottom: insets.bottom + 34 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF', ...SHADOW }} numberOfLines={1}>
              {`الشرح ${formatNumber(chapter.number)} · ${chapter.title}`}
            </Text>
            {nowIndex >= 0 ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.92)', marginTop: 4, ...SHADOW }} numberOfLines={2}>
                <Text style={{ fontFamily: fonts.bold, color: GOLD }}>{`${CLOCK(moments[nowIndex].t)}  `}</Text>
                {moments[nowIndex].text}
              </Text>
            ) : null}
          </TouchableOpacity>
        </>
      ) : null}

      <Timeline time={currentTime} duration={duration} moments={moments} bottom={insets.bottom} scrub={scrub}
        onScrub={setScrub} onSeek={seekTo} />

      <SheetModal visible={showMoments} onClose={() => setShowMoments(false)} style={{ backgroundColor: '#11152E', paddingTop: spacing.md, paddingHorizontal: spacing.lg, maxHeight: '72%' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#FFFFFF', marginBottom: spacing.sm }}>{t('tutorials.moments')}</Text>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}>
          {moments.map((m, i) => (
            <TouchableOpacity key={i} onPress={() => { seekTo(m.t); setShowMoments(false); }} activeOpacity={0.8}
              style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', paddingVertical: 10, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: i === nowIndex ? 'rgba(201,162,39,0.16)' : 'transparent' }}>
              <Text style={{ width: 44, fontFamily: fonts.bold, fontSize: 13, color: GOLD, fontVariant: ['tabular-nums'] }}>{CLOCK(m.t)}</Text>
              <Text style={{ flex: 1, fontFamily: i === nowIndex ? fonts.bold : fonts.regular, fontSize: 14, lineHeight: 22, color: '#FFFFFF' }}>{m.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SheetModal>
    </View>
  );
}

/**
 * The timeline along the bottom edge: a hairline that fills from the right (Arabic reads that
 * way), a tick at every «محطة». A finger on it — tap or drag — thickens it and scrubs; the
 * video jumps there when the finger lifts.
 */
function Timeline({ time, duration, moments, bottom, scrub, onScrub, onSeek }: {
  time: number; duration: number; moments: { t: number }[]; bottom: number;
  scrub: number | null; onScrub: (f: number | null) => void; onSeek: (s: number) => void;
}) {
  const width = useRef(1);
  const shown = scrub ?? (duration > 0 ? time / duration : 0);
  const at = (e: GestureResponderEvent) => {
    const x = Math.max(0, Math.min(width.current, e.nativeEvent.locationX));
    return I18nManager.isRTL ? 1 - x / width.current : x / width.current;
  };
  const pct = (f: number) => `${Math.max(0, Math.min(1, f)) * 100}%` as const;
  const thick = scrub !== null ? 6 : 3;
  return (
    <View onLayout={(e: LayoutChangeEvent) => { width.current = e.nativeEvent.layout.width || 1; }}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => onScrub(at(e))} onResponderMove={(e) => onScrub(at(e))}
      onResponderRelease={(e) => { const f = at(e); onScrub(null); onSeek(f * duration); }}
      onResponderTerminate={() => onScrub(null)}
      accessibilityRole="adjustable"
      style={{ position: 'absolute', left: 0, right: 0, bottom: bottom + 4, height: 30, justifyContent: 'center', paddingHorizontal: 10 }}>
      <View pointerEvents="none" style={{ height: thick, borderRadius: thick / 2, backgroundColor: 'rgba(255,255,255,0.28)' }}>
        <View style={{ position: 'absolute', start: 0, top: 0, bottom: 0, width: pct(shown), borderRadius: thick / 2, backgroundColor: scrub !== null ? '#FFFFFF' : GOLD }} />
        {duration > 0 ? moments.map((m, i) => (
          <View key={i} style={{ position: 'absolute', start: pct(m.t / duration), top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(10,14,39,0.75)' }} />
        )) : null}
      </View>
      {scrub !== null ? (
        <View pointerEvents="none" style={{ position: 'absolute', start: pct(shown), marginStart: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF' }} />
      ) : null}
    </View>
  );
}

function SideButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={{ alignItems: 'center', gap: 4 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center' }}>{children}</View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#FFFFFF', ...SHADOW }}>{label}</Text>
    </TouchableOpacity>
  );
}

function CloseButton({ onPress, top, label }: { onPress: () => void; top: number; label: string }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={10}
      style={{ position: 'absolute', top: top + 10, start: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
      <Icon name="close" size={22} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

