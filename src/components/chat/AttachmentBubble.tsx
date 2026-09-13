import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { attachmentHeaders, type ChatAttachment } from '@/api/chat';

/**
 * The file part of a chat bubble — an image, a voice note, or a document (spec §8).
 *
 * Every URL here is PRIVATE: it answers only with the bearer token and only for a member
 * of the room, so the image loader, the audio player and the download all carry the
 * token. Nothing is ever a plain public link that could be forwarded out of the room.
 */
export function AttachmentBubble({ attachment, mine, onLongPress }: { attachment: ChatAttachment; mine: boolean; onLongPress?: () => void }) {
  const { t } = useTranslation();
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let alive = true;
    attachmentHeaders().then((h) => { if (alive) setHeaders(h); });
    return () => { alive = false; };
  }, []);

  if (attachment.expired || !attachment.url) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
        <Icon name="clock" size={14} color={mine ? 'rgba(255,255,255,0.7)' : colors.textTertiary} outline />
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: mine ? 'rgba(255,255,255,0.8)' : colors.textTertiary }}>
          {t('chat.attachment_expired')}
        </Text>
      </View>
    );
  }

  if (!headers) {
    return <ActivityIndicator size="small" color={mine ? '#fff' : colors.primary} style={{ paddingVertical: spacing.md }} />;
  }

  if (attachment.kind === 'image') {
    return (
      <TouchableOpacity activeOpacity={0.9} onLongPress={onLongPress} delayLongPress={350} onPress={() => openFile(attachment, headers, t)}>
        <Image
          source={{ uri: attachment.url, headers }}
          style={{ width: 220, height: 220, borderRadius: radius.lg, backgroundColor: mine ? 'rgba(255,255,255,0.15)' : colors.surfaceSunken }}
          contentFit="cover"
          transition={150}
          accessibilityLabel={attachment.name ?? t('chat.photo')}
        />
      </TouchableOpacity>
    );
  }

  if (attachment.kind === 'voice') {
    return <VoiceBubble url={attachment.url} headers={headers} duration={attachment.duration ?? 0} mine={mine} />;
  }

  return (
    <TouchableOpacity
      onPress={() => openFile(attachment, headers, t)}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.8}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, paddingHorizontal: 8, borderRadius: radius.md, backgroundColor: mine ? 'rgba(255,255,255,0.14)' : colors.surfaceSunken, borderWidth: mine ? 0 : 1, borderColor: colors.border, maxWidth: 260 }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: mine ? 'rgba(255,255,255,0.2)' : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="quiz" size={20} color={mine ? '#fff' : colors.brand} outline />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 14, color: mine ? '#fff' : colors.textPrimary, textAlign: 'right' }}>
          {attachment.name ?? t('chat.file')}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: mine ? 'rgba(255,255,255,0.7)' : colors.textTertiary, textAlign: 'right' }}>
          {attachment.size ? `${Math.max(1, Math.round(attachment.size / 1024))} ك.ب · ` : ''}{t('chat.open_file')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** Play / pause with a thin progress bar. The player streams with the bearer token. */
function VoiceBubble({ url, headers, duration, mine }: { url: string; headers: Record<string, string>; duration: number; mine: boolean }) {
  const player = useAudioPlayer({ uri: url, headers });
  const status = useAudioPlayerStatus(player);
  const total = status.duration > 0 ? status.duration : duration;
  const progress = total > 0 ? Math.min(1, status.currentTime / total) : 0;

  useEffect(() => {
    // Silent switch on iPhones must not swallow a voice note the child tapped to hear.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (status.didJustFinish) {
      try { player.seekTo(0); player.pause(); } catch { /* ignore */ }
    }
  }, [status.didJustFinish, player]);

  const toggle = () => {
    try {
      if (status.playing) player.pause();
      else player.play();
    } catch { /* ignore */ }
  };

  const fg = mine ? '#fff' : colors.brand;
  const shown = status.playing || status.currentTime > 0 ? status.currentTime : total;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 200, paddingVertical: 4 }}>
      <TouchableOpacity onPress={toggle} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: mine ? 'rgba(255,255,255,0.2)' : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        {!status.isLoaded && !status.playing ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <Icon name={status.playing ? 'close' : 'send'} size={18} color={fg} />
        )}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: mine ? 'rgba(255,255,255,0.3)' : colors.border, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: fg }} />
        </View>
      </View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: mine ? 'rgba(255,255,255,0.85)' : colors.textSecondary, minWidth: 34, textAlign: 'left' }}>
        {fmt(shown)}
      </Text>
    </View>
  );
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Download into the app cache with the token, then hand to the system share sheet — the
 * same path the PDF reports use, for the same reason: a Custom Tab cannot carry our
 * bearer token, and on Samsung the download-manager hand-off cold-restarts the app.
 */
async function openFile(attachment: ChatAttachment, headers: Record<string, string>, t: (k: string) => string): Promise<void> {
  if (!attachment.url) return;
  try {
    const cleaned = (attachment.name || 'file').replace(/[\/\\:*?"<>|\s]+/g, '_').replace(/^[._-]+|[._-]+$/g, '') || 'file';
    const dest = new File(Paths.cache, cleaned);
    try { if (dest.exists) dest.delete(); } catch { /* best effort */ }
    const file = await File.downloadFileAsync(attachment.url, dest, { headers });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: attachment.mime ?? undefined, dialogTitle: attachment.name ?? undefined });
    } else {
      Alert.alert('', t('chat.open_file_failed'));
    }
  } catch {
    Alert.alert('', t('chat.open_file_failed'));
  }
}
