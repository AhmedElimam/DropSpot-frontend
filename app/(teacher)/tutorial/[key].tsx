import { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StatusBar } from 'expo-status-bar';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTutorials } from '@/hooks/useTutorials';

/**
 * One «شروحات» chapter, full screen on black, playing at once with the system controls
 * (pause, scrub, full screen). Silent by design — the captions are in the video.
 * Reached from the list, or straight from a screen it explains (e.g. Rose's desk → «rose»).
 */
export default function TutorialPlayer() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { data, isLoading } = useTutorials();
  const chapter = (data ?? []).find((c) => c.key === key) ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + spacing.xs, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        {chapter ? <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: '#FFFFFF' }} numberOfLines={1}>{chapter.title}</Text> : null}
      </View>
      {chapter ? (
        <Player url={chapter.url} hls={!!chapter.hls} bottom={insets.bottom} />
      ) : isLoading ? (
        <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: spacing.xxl }} />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
          <EmptyState icon="play" title={t('tutorials.missing')} message={t('tutorials.empty_hint')} />
        </View>
      )}
    </View>
  );
}

// The chapter streams ENCRYPTED (AES-128 HLS, a per-viewer key from the server — founder
// 2026-10-09); its link carries no «.m3u8», so the player is told what it is.
function Player({ url, hls, bottom }: { url: string; hls: boolean; bottom: number }) {
  const player = useVideoPlayer(hls ? { uri: url, contentType: 'hls' } : url, (p) => {
    p.muted = false;
    p.play();
  });
  // Leaving the screen stops it; nothing keeps playing behind the app.
  useEffect(() => () => { try { player.pause(); } catch { /* released */ } }, [player]);
  return (
    <VideoView player={player} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }}
      style={{ flex: 1, marginBottom: bottom }} />
  );
}
