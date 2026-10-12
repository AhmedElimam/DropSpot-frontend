import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { chat } from '@/theme/chat';
import { Icon } from '@/components/ui/Icon';
import { VoiceNote } from '@/components/chat/VoiceNote';
import { ImageViewer } from '@/components/chat/ImageViewer';
import { FilePreview, canPreviewInApp } from '@/components/chat/FilePreview';
import { LinearGradient } from 'expo-linear-gradient';
import { DocumentCard, fileSizeLabel } from '@/components/chat/DocumentCard';
import { attachmentHeaders, type ChatAttachment, type ChatAttachmentMeta } from '@/api/chat';

const PHOTO_W = 232;

/** A photo keeps its shape (from the server's width/height), within a sensible band. */
export function photoHeight(meta: ChatAttachmentMeta | null | undefined): number {
  if (!meta?.width || !meta?.height) return PHOTO_W;
  return Math.round(Math.max(150, Math.min(310, PHOTO_W * (meta.height / meta.width))));
}

/**
 * The file part of a chat bubble — an image, a voice note, or a document (spec §8).
 *
 * Every URL here is PRIVATE: it answers only with the bearer token and only for a member of
 * the room, so the image loader, the audio player and the download all carry the token.
 * Nothing is ever a plain public link that could be forwarded out of the room.
 *
 * A tap OPENS the thing, inside the app: a photo in the full-screen viewer, a document in
 * the in-app preview where the device can render it. Handing straight to the system share
 * sheet — what a tap used to do — is now the "share" action inside those, and the fallback
 * for a format this device cannot show (founder, 2026-09-20: "handled inside the app like
 * WhatsApp").
 */
export function AttachmentBubble({ attachment, mine, seed, onLongPress }: {
  attachment: ChatAttachment;
  mine: boolean;
  /** Message id — gives the voice note a stable waveform. */
  seed: number;
  onLongPress?: () => void;
}) {
  const { t } = useTranslation();
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [open, setOpen] = useState<'image' | 'file' | null>(null);

  useEffect(() => {
    let alive = true;
    attachmentHeaders().then((h) => { if (alive) setHeaders(h); });
    return () => { alive = false; };
  }, []);

  if (attachment.expired || !attachment.url) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
        <Icon name="clock" size={14} color={mine ? chat.metaOnMine : colors.textTertiary} outline />
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: mine ? chat.metaOnMine : colors.textTertiary }}>
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
      <>
        <TouchableOpacity activeOpacity={0.9} onLongPress={onLongPress} delayLongPress={350} onPress={() => setOpen('image')}
          style={{ width: PHOTO_W, height: photoHeight(attachment.meta), borderRadius: radius.lg, overflow: 'hidden', backgroundColor: mine ? 'rgba(255,255,255,0.14)' : colors.surfaceSunken }}>
          <Image
            source={{ uri: attachment.url, headers }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={attachment.name ?? t('chat.photo')}
          />
          {/* The photo's name and size on a soft shade at its foot (founder 2026-10-12:
              «media doesn't have a name»). */}
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 22, paddingBottom: 6, paddingHorizontal: 10 }}>
            <Text numberOfLines={1} ellipsizeMode="middle" style={{ fontFamily: fonts.medium, fontSize: 11, color: '#FFFFFF', textAlign: 'right', writingDirection: 'ltr' }}>
              {[attachment.name ?? t('chat.photo'), fileSizeLabel(attachment.size)].filter(Boolean).join(' · ')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        <ImageViewer
          visible={open === 'image'}
          url={attachment.url}
          headers={headers}
          name={attachment.name}
          onClose={() => setOpen(null)}
          onShare={() => openFile(attachment, headers, t)}
        />
      </>
    );
  }

  if (attachment.kind === 'voice') {
    return <VoiceNote url={attachment.url} headers={headers} duration={attachment.duration ?? 0} mine={mine} seed={seed} />;
  }

  const previewable = canPreviewInApp(attachment.mime);

  return (
    <>
    <DocumentCard
      attachment={attachment}
      headers={headers}
      mine={mine}
      hint={previewable ? t('chat.open_file') : t('chat.open_externally')}
      onPress={() => (previewable ? setOpen('file') : openFile(attachment, headers, t))}
      onLongPress={onLongPress}
    />
    {previewable ? (
      <FilePreview
        visible={open === 'file'}
        url={attachment.url}
        headers={headers}
        name={attachment.name}
        onClose={() => setOpen(null)}
        onOpenExternally={() => openFile(attachment, headers, t)}
      />
    ) : null}
    </>
  );
}

/**
 * Download into the app cache with the token, then hand to the system share sheet — the same
 * path the PDF reports use, for the same reason: a Custom Tab cannot carry our bearer token,
 * and on Samsung the download-manager hand-off cold-restarts the app.
 */
export async function openFile(attachment: ChatAttachment, headers: Record<string, string>, t: (k: string) => string): Promise<void> {
  if (!attachment.url) return;
  try {
    // An optimistic (not yet uploaded) attachment IS a local file already — share it as is.
    const local = attachment.url.startsWith('file:');
    const cleaned = (attachment.name || 'file').replace(/[\/\\:*?"<>|\s]+/g, '_').replace(/^[._-]+|[._-]+$/g, '') || 'file';
    let uri = attachment.url;
    if (!local) {
      const dest = new File(Paths.cache, cleaned);
      try { if (dest.exists) dest.delete(); } catch { /* best effort */ }
      uri = (await File.downloadFileAsync(attachment.url, dest, { headers })).uri;
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: attachment.mime ?? undefined, dialogTitle: attachment.name ?? undefined });
    } else {
      Alert.alert('', t('chat.open_file_failed'));
    }
  } catch {
    Alert.alert('', t('chat.open_file_failed'));
  }
}
