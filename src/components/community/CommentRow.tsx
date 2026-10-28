import { memo } from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { ago } from '@/components/threads/format';
import type { CommunityComment, CommunityMedia } from '@/api/community';
import { CommunityAvatar } from './CommunityAvatar';
import { roleLabel } from './PostCard';

/**
 * One comment as a bubble (the face, the name, the words, a picture it carries), with when and
 * «المزيد» under it. Shared by the comments sheet, a picture's thread in the viewer and the post
 * page. The author's own held or rejected comment says why, in the bubble.
 */
export const CommentRow = memo(function CommentRow({ comment: c, headers, onMore, onOpenPicture, side = 0 }: {
  comment: CommunityComment;
  headers: Record<string, string> | null;
  onMore: (c: CommunityComment) => void;
  /** Open the carried picture full screen (absent where a viewer can't open: inside a sheet). */
  onOpenPicture?: (m: CommunityMedia) => void;
  /** Extra side padding (the post page lines comments up with its cards). */
  side?: number;
}) {
  const { t } = useTranslation();
  const chip = roleLabel(c.author.role, t);
  // A held comment that read as someone hurting is answered gently, not as a hold (the spec §5.1).
  const support = c.status === 'held' && c.status_reason === 'support';
  const status = c.status !== 'published' && !support ? c.status : null;
  const pic = c.attachment;
  const picW = pic?.width && pic?.height ? Math.min(200, Math.round(160 * (pic.width / pic.height))) : 180;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: side, paddingVertical: 6 }}>
      <CommunityAvatar author={c.author} size={34} />
      <View style={{ flex: 1 }}>
        {c.body || status || support ? (
          <Pressable onLongPress={() => onMore(c)} delayLongPress={300} style={{ alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: status ? (status === 'rejected' ? colors.dangerLight : colors.warningLight) : colors.surfaceSunken, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{c.author.name}</Text>
              {chip ? <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: colors.brand }}>{chip}</Text> : null}
            </View>
            {c.body ? <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 22, color: colors.textPrimary }}>{c.body}</Text> : null}
            {status ? (
              <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: status === 'rejected' ? colors.dangerText : colors.warningText, marginTop: 2 }}>
                {t(status === 'rejected' ? 'community_space.status_rejected' : c.status_reason === 'awaiting_review' ? 'community_space.status_awaiting' : 'community_space.status_held')}{c.status_note ? ` — ${c.status_note}` : ''}
              </Text>
            ) : null}
            {support && c.status_note ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: colors.brand, marginTop: 2 }}>{c.status_note}</Text> : null}
          </Pressable>
        ) : (
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 4, marginHorizontal: spacing.sm }} numberOfLines={1}>{c.author.name}</Text>
        )}
        {pic ? (
          <Pressable onPress={onOpenPicture ? () => onOpenPicture(pic) : undefined} onLongPress={() => onMore(c)} disabled={!onOpenPicture} style={{ marginTop: 4, alignSelf: 'flex-start' }}
            accessibilityRole={onOpenPicture ? 'imagebutton' : 'image'} accessibilityLabel={t('community_space.photo')}>
            <Image source={{ uri: pic.url, headers: headers ?? undefined }} style={{ width: picW, height: 160, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }} contentFit="cover" transition={120} />
          </Pressable>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 3, marginHorizontal: spacing.sm }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>{ago(c.created_at)}</Text>
          <TouchableOpacity onPress={() => onMore(c)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('community_space.more')}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary }}>{t('community_space.more')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});
