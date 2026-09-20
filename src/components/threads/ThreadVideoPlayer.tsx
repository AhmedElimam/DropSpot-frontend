import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, Animated, Easing, Platform, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ScreenCapture from 'expo-screen-capture';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { openThreadVideoPlay, reportThreadCapture, type ThreadPlay, type ThreadVideo } from '@/api/threads';

/**
 * The teacher's short video, full screen, with the trail a leaked copy would carry.
 *
 * What is under the app's control, and done here:
 *  1. Capture is BLOCKED while this is mounted — `usePreventScreenCapture`: Android's
 *     FLAG_SECURE makes screenshots and recordings black, iOS blanks the secure layer.
 *  2. A second phone filming the screen cannot be blocked, so the watching student's NAME,
 *     CODE and this viewing's six-letter play code drift across the picture for the whole
 *     playback (and the DrosSpot mark sits in a corner that changes). A copy therefore names
 *     its own source; the teacher types the code in and gets the row.
 *  3. The stream URL is the viewing's token — issued when this opens, dead within hours.
 *  4. A screenshot the OS reports is posted as a capture event; the teacher is told.
 *
 * No fullscreen hand-off, no picture-in-picture: both would take the picture out from under
 * the overlay.
 */
export function ThreadVideoPlayer({ video, onClose }: { video: ThreadVideo | null; onClose: () => void }) {
  const visible = !!video;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent presentationStyle="fullScreen">
      {video ? <PlayerBody video={video} onClose={onClose} /> : null}
    </Modal>
  );
}

function PlayerBody({ video, onClose }: { video: ThreadVideo; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [play, setPlay] = useState<ThreadPlay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState(false);

  // (1) Block capture for as long as the video is on screen.
  ScreenCapture.usePreventScreenCapture('thread-video');

  // (3) One viewing = one row = one URL.
  useEffect(() => {
    let alive = true;
    openThreadVideoPlay(video.id)
      .then((p) => { if (alive) setPlay(p); })
      .catch((e) => { if (alive) setError(e?.response?.data?.message ?? t('threads.video_error')); });
    return () => { alive = false; };
  }, [video.id]);

  // (4) A screenshot the OS reports → the teacher knows, and the student sees that it was noticed.
  useEffect(() => {
    const sub = ScreenCapture.addScreenshotListener(() => {
      setCaptured(true);
      reportThreadCapture(video.id, play?.play_id ?? null, 'screenshot', Platform.OS);
      setTimeout(() => setCaptured(false), 4000);
    });
    return () => sub.remove();
  }, [video.id, play?.play_id]);

  const player = useVideoPlayer(play ? { uri: play.url } : null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0;
  });
  useEffect(() => {
    if (play) { try { player.play(); } catch { /* not ready yet */ } }
  }, [play?.play_id]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {play ? (
        <VideoView
          player={player}
          style={{ width, height }}
          contentFit="contain"
          nativeControls
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          startsPictureInPictureAutomatically={false}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl }}>
          {error ? (
            <>
              <Icon name="error" size={40} color="#fff" />
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: '#fff', textAlign: 'center' }}>{error}</Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{t('threads.video_loading')}</Text>
            </>
          )}
        </View>
      )}

      {/* (2) The forensic overlay. Above the player, below the close button; never intercepts touches. */}
      {play ? <Watermark play={play} width={width} height={height} /> : null}

      {captured ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 64, left: spacing.lg, right: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: 'rgba(203,58,76,0.92)', flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Icon name="shield" size={20} color="#fff" />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20, color: '#fff', textAlign: 'right' }}>{t('threads.capture_blocked')}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={onClose}
        accessibilityLabel={t('common.close')}
        style={{ position: 'absolute', top: insets.top + spacing.sm, end: spacing.md, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="close" size={24} color="#fff" />
      </TouchableOpacity>

      <View pointerEvents="none" style={{ position: 'absolute', bottom: insets.bottom + spacing.md, left: spacing.lg, right: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
        <Icon name="shield" size={13} color="rgba(255,255,255,0.6)" outline />
        <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>{t('threads.video_protected')}</Text>
      </View>
    </View>
  );
}

/**
 * Two marks. The big one — name · student code · play code — glides along a slow diagonal
 * path that never repeats exactly (two incommensurate periods), so no fixed crop removes it.
 * The small DrosSpot · code mark hops between corners every few seconds.
 */
function Watermark({ play, width, height }: { play: ThreadPlay; width: number; height: number }) {
  const { t } = useTranslation();
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const [corner, setCorner] = useState(0);

  useEffect(() => {
    const loopX = Animated.loop(Animated.sequence([
      Animated.timing(x, { toValue: 1, duration: 13000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(x, { toValue: 0, duration: 13000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const loopY = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: 1, duration: 8300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 8300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loopX.start();
    loopY.start();
    const hop = setInterval(() => setCorner((c) => (c + 1) % 4), 5000);
    return () => { loopX.stop(); loopY.stop(); clearInterval(hop); };
  }, []);

  const label = useMemo(() => {
    const parts = [play.watermark.name, play.watermark.student_code, play.watermark.phone_tail ? `…${play.watermark.phone_tail}` : null].filter(Boolean);
    return parts.join(' · ');
  }, [play]);

  const travelX = Math.max(0, width - 240);
  const travelY = Math.max(0, height - 180);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [0, travelX] });
  const translateY = y.interpolate({ inputRange: [0, 1], outputRange: [60, 60 + travelY] });

  const cornerStyle = [
    { top: 90, left: 14 }, { top: 90, right: 14 }, { bottom: 70, right: 14 }, { bottom: 70, left: 14 },
  ][corner];

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height }}>
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateX }, { translateY }], alignItems: 'flex-start' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: 'rgba(255,255,255,0.55)', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>
          {label}
        </Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, letterSpacing: 2, color: 'rgba(255,255,255,0.5)', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>
          {play.watermark.code}
        </Text>
      </Animated.View>
      <View style={[{ position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: 'rgba(0,0,0,0.35)' }, cornerStyle]}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentWarm }} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{t('threads.watermark_prefix')} · {play.watermark.code}</Text>
      </View>
    </View>
  );
}
