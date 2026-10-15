import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated as RNAnimated, Easing as RNEasing, Platform, useWindowDimensions } from 'react-native';
import { AppModal as Modal } from '@/ui/AppModal';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ScreenCapture from 'expo-screen-capture';
import { fonts } from '@/theme/typography';
import { spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { haptic } from '@/utils/haptics';
import { openThreadVideoPlay, reportThreadCapture, type ThreadPlay, type ThreadVideo } from '@/api/threads';
import { addScreenCaptureListener, isScreenCaptured } from '@/lib/drosMedia';
import { STREAM_HEADERS } from './mediaHeaders';
import { CrestMedallion, CrestOutro } from './CrestOutro';

type CaptureKind = 'screenshot' | 'recording';

/**
 * The teacher's video, full screen, with the trail a leaked copy would carry.
 *
 * What is under the app's control, and done here:
 *  1. Capture is BLOCKED while this is mounted — `usePreventScreenCapture`: Android's
 *     FLAG_SECURE makes screenshots and recordings black, iOS blanks the secure layer.
 *  2. A second phone filming the screen cannot be blocked, so the watching student's NAME,
 *     CODE and this viewing's six-letter play code drift across the picture for the whole
 *     playback — the end card included — and the DrosSpot mark sits in a corner that changes.
 *     A copy therefore names its own source; the teacher types the code in and gets the row.
 *  3. The stream URL is the viewing's token — issued when this opens, dead within hours. The
 *     player sends the staging door key with it on a staging build (STREAM_HEADERS); without
 *     it stg answered 404 and every video "uploaded but never played" (2026-10-15).
 *  4. Capture attempts the OS reports are posted as capture events and the teacher is told:
 *     a screenshot (expo-screen-capture's listener) and, on iOS, a screen RECORDING — running
 *     when the video opens, or started while it plays (DrosMedia: UIScreen.isCaptured). Android
 *     cannot report a recording at all; FLAG_SECURE turns it black instead.
 *  5. At the end, the outro in Madam Rose's crest (CrestOutro.tsx, founder 2026-10-15): the gold
 *     ring and laurel, the DS medallion, «حكاوي», the teacher's ribbon, the website, the viewer
 *     and the play code — under the same moving watermark.
 *
 * No fullscreen hand-off, no picture-in-picture: both would take the picture out from under
 * the overlay.
 */
export type OutroTeacher = { name: string; subject?: string | null; logo_url?: string | null };

export function ThreadVideoPlayer({ video, teacher, gradeName, onClose }: {
  video: ThreadVideo | null;
  /** For the outro's ribbon and line: name, subject and logo when the server sends them. */
  teacher?: OutroTeacher | null;
  gradeName?: string | null;
  onClose: () => void;
}) {
  const visible = !!video;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent presentationStyle="fullScreen">
      {video ? <PlayerBody video={video} teacher={teacher ?? null} gradeName={gradeName ?? null} onClose={onClose} /> : null}
    </Modal>
  );
}

function PlayerBody({ video, teacher, gradeName, onClose }: { video: ThreadVideo; teacher: OutroTeacher | null; gradeName: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [play, setPlay] = useState<ThreadPlay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<CaptureKind | null>(null);
  const [ended, setEnded] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // (1) Block capture for as long as the video is on screen.
  ScreenCapture.usePreventScreenCapture('thread-video');

  // (3) One viewing = one row = one URL.
  useEffect(() => {
    let alive = true;
    openThreadVideoPlay(video.id)
      .then((p) => { if (alive) setPlay(p); })
      .catch((e) => { if (alive) setError(e?.response?.data?.message ?? t('threads.video_error')); });
    return () => { alive = false; };
  }, [video.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // (4) Capture attempts → the teacher knows, and the student sees that it was noticed.
  const playId = play?.play_id ?? null;
  useEffect(() => {
    const report = (kind: CaptureKind) => {
      reportThreadCapture(video.id, playId, kind, Platform.OS);
      haptic('warning');
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      setCaptured(kind);
      // A screenshot is one moment; a recording's banner stays while the recording does.
      if (kind === 'screenshot') bannerTimer.current = setTimeout(() => setCaptured(null), 4500);
    };
    const shot = ScreenCapture.addScreenshotListener(() => report('screenshot'));
    // Recording state: iOS only (Android: the module answers false and never fires).
    let alive = true;
    if (playId) {
      isScreenCaptured().then((on) => { if (alive && on) report('recording'); });
    }
    const rec = addScreenCaptureListener((on) => {
      if (on) report('recording');
      else setCaptured((c) => (c === 'recording' ? null : c));
    });
    return () => {
      alive = false;
      shot.remove();
      rec?.remove();
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [video.id, playId]);

  const source = useMemo(() => (play ? { uri: play.url, headers: STREAM_HEADERS } : null), [play]);
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0;
  });
  useEffect(() => {
    if (play) { try { player.play(); } catch { /* not ready yet */ } }
  }, [play?.play_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // (5) The outro on the last frame; any new playback hides it.
  useEventListener(player, 'playToEnd', () => setEnded(true));
  useEventListener(player, 'playingChange', ({ isPlaying }) => { if (isPlaying) setEnded(false); });
  const replay = () => {
    setEnded(false);
    player.currentTime = 0;
    player.play();
  };

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

      {play && ended ? (
        <CrestOutro teacher={teacher} gradeName={gradeName} viewerName={play.watermark.name} code={play.watermark.code} onReplay={replay} onBack={onClose} />
      ) : null}

      {/* (2) The forensic overlay. Above the player AND the end card, below the buttons; never intercepts touches. */}
      {play ? <Watermark play={play} width={width} height={height} /> : null}

      {captured ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 64, left: spacing.lg, right: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: 'rgba(203,58,76,0.94)', flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Icon name="shield" size={20} color="#fff" />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20, color: '#fff', textAlign: 'right' }}>
            {captured === 'recording' ? t('threads.capture_recording') : t('threads.capture_blocked')}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={onClose}
        accessibilityLabel={t('common.close')}
        style={{ position: 'absolute', top: insets.top + spacing.sm, end: spacing.md, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="close" size={24} color="#fff" />
      </TouchableOpacity>

      {!ended ? (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: insets.bottom + spacing.md, left: spacing.lg, right: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <Icon name="shield" size={13} color="rgba(255,255,255,0.6)" outline />
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>{t('threads.video_protected')}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Two marks. The big one — name | student code | play code — glides along a slow diagonal
 * path that never repeats exactly (two incommensurate periods), so no fixed crop removes it.
 * The small crest medallion + play code hops between corners every few seconds.
 */
function Watermark({ play, width, height }: { play: ThreadPlay; width: number; height: number }) {
  const x = useRef(new RNAnimated.Value(0)).current;
  const y = useRef(new RNAnimated.Value(0)).current;
  const [corner, setCorner] = useState(0);

  useEffect(() => {
    const loopX = RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.timing(x, { toValue: 1, duration: 13000, easing: RNEasing.inOut(RNEasing.sin), useNativeDriver: true }),
      RNAnimated.timing(x, { toValue: 0, duration: 13000, easing: RNEasing.inOut(RNEasing.sin), useNativeDriver: true }),
    ]));
    const loopY = RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.timing(y, { toValue: 1, duration: 8300, easing: RNEasing.inOut(RNEasing.sin), useNativeDriver: true }),
      RNAnimated.timing(y, { toValue: 0, duration: 8300, easing: RNEasing.inOut(RNEasing.sin), useNativeDriver: true }),
    ]));
    loopX.start();
    loopY.start();
    const hop = setInterval(() => setCorner((c) => (c + 1) % 4), 5000);
    return () => { loopX.stop(); loopY.stop(); clearInterval(hop); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bars, not a middle dot: «·» beside digits reads as a zero in Arabic.
  const label = useMemo(() => {
    const parts = [play.watermark.name, play.watermark.student_code, play.watermark.phone_tail ? `…${play.watermark.phone_tail}` : null].filter(Boolean);
    return parts.join('  |  ');
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
      <RNAnimated.View style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateX }, { translateY }], alignItems: 'flex-start' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: 'rgba(255,255,255,0.55)', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>
          {label}
        </Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, letterSpacing: 2, color: 'rgba(255,255,255,0.5)', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>
          {play.watermark.code}
        </Text>
      </RNAnimated.View>
      <View style={[{ position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: 'rgba(0,0,0,0.35)' }, cornerStyle]}>
        <CrestMedallion size={20} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,255,255,0.85)', letterSpacing: 1 }}>{play.watermark.code}</Text>
      </View>
    </View>
  );
}
