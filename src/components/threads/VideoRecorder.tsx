import { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { VideoView, useVideoPlayer } from 'expo-video';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

export interface RecordedClip {
  uri: string;
  duration: number;
  mime: string;
  name: string;
}

/**
 * The teacher's answer camera — a vertical, front-facing, one-take recorder with a hard stop
 * at the server's cap. Record → review → use or retake. Nothing is uploaded from here; the
 * caller gets the clip and decides.
 */
export function VideoRecorder({ visible, maxSeconds, onClose, onRecorded }: {
  visible: boolean;
  maxSeconds: number;
  onClose: () => void;
  onRecorded: (clip: RecordedClip) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [cam, requestCam] = useCameraPermissions();
  const [mic, requestMic] = useMicrophonePermissions();
  const camera = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<RecordedClip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    if (!visible) { setClip(null); setRecording(false); setElapsed(0); setError(null); }
  }, [visible]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const s = Math.round((Date.now() - startedAt.current) / 1000);
      setElapsed(s);
      if (s >= maxSeconds) camera.current?.stopRecording();
    }, 250);
    return () => clearInterval(id);
  }, [recording, maxSeconds]);

  const granted = cam?.granted && mic?.granted;

  const start = async () => {
    if (!camera.current || recording) return;
    setError(null);
    setRecording(true);
    startedAt.current = Date.now();
    try {
      const result = await camera.current.recordAsync({ maxDuration: maxSeconds });
      const duration = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
      if (result?.uri) {
        const isMov = result.uri.toLowerCase().endsWith('.mov');
        setClip({ uri: result.uri, duration, mime: isMov ? 'video/quicktime' : 'video/mp4', name: `answer.${isMov ? 'mov' : 'mp4'}` });
      } else {
        setError(t('threads.recorder_failed'));
      }
    } catch {
      setError(t('threads.recorder_failed'));
    } finally {
      setRecording(false);
    }
  };

  const stop = () => camera.current?.stopRecording();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {!granted ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
            <Icon name="video" size={48} color="#fff" outline />
            <Text style={{ fontFamily: fonts.medium, fontSize: 16, lineHeight: 26, color: '#fff', textAlign: 'center' }}>{t('threads.recorder_permission')}</Text>
            <Button title={t('threads.recorder_grant')} onPress={async () => { await requestCam(); await requestMic(); }} />
          </View>
        ) : clip ? (
          <Review clip={clip} onRetake={() => setClip(null)} onUse={() => onRecorded(clip)} />
        ) : (
          <CameraView ref={camera} style={{ flex: 1 }} facing={facing} mode="video" videoQuality="720p" mute={false} />
        )}

        {/* Header */}
        <View style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TouchableOpacity onPress={onClose} disabled={recording} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', opacity: recording ? 0.4 : 1 }}>
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff', textAlign: 'right' }}>{t('threads.recorder_title')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'right' }}>{t('threads.recorder_hint', { seconds: maxSeconds })}</Text>
          </View>
          {!clip ? (
            <TouchableOpacity onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))} disabled={recording} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="flipCamera" size={22} color="#fff" outline />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Controls */}
        {granted && !clip ? (
          <View style={{ position: 'absolute', bottom: insets.bottom + spacing.xl, left: 0, right: 0, alignItems: 'center', gap: spacing.md }}>
            {error ? <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#FFB4BD' }}>{error}</Text> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full, backgroundColor: recording ? 'rgba(203,58,76,0.9)' : 'rgba(0,0,0,0.5)' }}>
              {recording ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} /> : null}
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff', fontVariant: ['tabular-nums'] }}>{fmt(elapsed)} / {fmt(maxSeconds)}</Text>
            </View>
            <TouchableOpacity
              onPress={recording ? stop : start}
              accessibilityLabel={recording ? t('threads.recorder_stop') : t('threads.recorder_start')}
              style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }}
            >
              <View style={recording ? { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.danger } : { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.danger }} />
            </TouchableOpacity>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{recording ? t('threads.recorder_stop') : t('threads.recorder_start')}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function Review({ clip, onRetake, onUse }: { clip: RecordedClip; onRetake: () => void; onUse: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer({ uri: clip.uri }, (p) => { p.loop = true; p.play(); });

  return (
    <View style={{ flex: 1 }}>
      <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls={false} allowsFullscreen={false} allowsPictureInPicture={false} />
      <View style={{ position: 'absolute', bottom: insets.bottom + spacing.xl, left: spacing.lg, right: spacing.lg, gap: spacing.sm }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>{t('threads.video_attached', { seconds: clip.duration })}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}><Button title={t('threads.recorder_retake')} variant="outline" onPress={onRetake} /></View>
          <View style={{ flex: 2 }}><Button title={t('threads.recorder_use')} variant="success" onPress={onUse} /></View>
        </View>
      </View>
    </View>
  );
}

function fmt(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export const recorderPlatform = Platform.OS;
