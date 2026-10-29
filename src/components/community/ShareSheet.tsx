import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Platform, Share } from 'react-native';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SheetModal } from '@/components/ui/SheetModal';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useCommunityShareLink } from '@/hooks/useCommunity';
import { attachmentHeaders } from '@/api/chat';
import { useMediaHeaders } from '@/components/threads/mediaHeaders';
import type { CommunityPost } from '@/api/community';

/**
 * «مشاركة» a community post (founder 2026-10-29): the post's public link — drosspot.app/c/… —
 * which opens a small page with the live post under a «حمّل التطبيق» card. The server decides
 * what that page shows: a students'-community post is a locked card there, nothing of the
 * child, so the sheet says so instead of pretending it is public.
 *
 * Core React Native only (Share, Linking): no clipboard module, nothing native — OTA-safe. The
 * link is selectable, so a long press copies it.
 *
 * The post goes with its picture (founder 2026-10-29: «share doesn't include media»): the sheet
 * shows what the receiver gets — the post and its first picture, or the locked card — and
 * «مشاركة…» on an iPhone attaches that picture to the link. On Android the phone's sheet takes
 * text only, so the link's own preview carries the picture (the page's og:image). A students'
 * post never sends a picture out.
 */
export function ShareSheet({ post, onClose }: { post: CommunityPost | null; onClose: () => void }) {
  const { t } = useTranslation();
  const link = useCommunityShareLink(post?.id ?? null);
  const locked = post?.audience === 'students' && post.author.role !== 'staff';
  const data = link.data;
  const headers = useMediaHeaders();
  const picture = !locked ? post?.media?.[0] ?? null : null;
  const [preparing, setPreparing] = useState(false);

  const shareAll = async () => {
    if (!data) return;
    let url: string | undefined;
    if (picture && Platform.OS === 'ios') {
      setPreparing(true);
      try {
        const dest = new File(Paths.cache, `community-post-${post?.id ?? 0}.jpg`);
        try { if (dest.exists) dest.delete(); } catch { /* best effort */ }
        url = (await File.downloadFileAsync(picture.url, dest, { headers: await attachmentHeaders() })).uri;
      } catch {
        url = undefined; // the link alone still carries the picture in its preview
      } finally {
        setPreparing(false);
      }
    }
    try {
      await Share.share(url ? { message: data.text, url } : { message: data.text, title: data.title });
    } catch {
      // The person closed the phone's sheet: nothing to say.
    }
  };
  const whatsapp = () => {
    if (data) void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(data.text)}`);
  };

  return (
    <SheetModal visible={post !== null} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="share" size={21} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('community_space.share_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }}>
            {t(locked ? 'community_space.share_hint_locked' : 'community_space.share_hint')}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight }}>
          <Icon name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {post ? <Preview post={post} locked={locked} headers={headers} /> : null}

      {link.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
      ) : link.isError || !data ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', marginVertical: spacing.lg }}>
          {getFriendlyErrorMessage(link.error)}
        </Text>
      ) : (
        <>
          {/* The link itself: selectable, so a long press copies it. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 12, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }}>
            <Icon name="link" size={18} color={colors.textSecondary} />
            <Text selectable numberOfLines={1} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, writingDirection: 'ltr', textAlign: 'left' }}>{data.url}</Text>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 6, marginBottom: spacing.md }}>{t('community_space.share_copy_hint')}</Text>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Action icon="whatsapp" tint={colors.whatsapp} label={t('community_space.share_whatsapp')} onPress={whatsapp} />
            <Action icon="share" tint={colors.brand} label={t('community_space.share_more')} onPress={shareAll} primary busy={preparing} />
          </View>
        </>
      )}
    </SheetModal>
  );
}

/** What the receiver gets: the post with its first picture, or — a students' post — the locked card. */
function Preview({ post, locked, headers }: { post: CommunityPost; locked: boolean; headers: Record<string, string> | null }) {
  const { t } = useTranslation();
  if (locked) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, marginBottom: spacing.md }}>
        <Icon name="lock" size={18} color={colors.textSecondary} />
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>{t('community_space.share_preview_locked')}</Text>
      </View>
    );
  }
  const pic = post.media?.[0];
  const more = (post.media?.length ?? 0) - 1;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surface, marginBottom: spacing.md }}>
      {pic ? (
        <View style={{ width: 72, height: 72, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSunken }}>
          <Image source={{ uri: pic.url, headers: headers ?? undefined }} style={{ width: 72, height: 72 }} contentFit="cover" transition={120} />
          {more > 0 ? (
            <View style={{ position: 'absolute', bottom: 4, end: 4, paddingHorizontal: 6, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#FFFFFF' }}>{`+${more}`}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }}>{post.author.name}</Text>
        {post.body ? <Text numberOfLines={pic ? 2 : 3} style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 2 }}>{post.body}</Text> : null}
      </View>
    </View>
  );
}

function Action({ icon, tint, label, onPress, primary, busy }: { icon: IconName; tint: string; label: string; onPress: () => void; primary?: boolean; busy?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={busy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={label}
      style={{ flex: 1, height: 50, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: primary ? colors.brand : colors.surface, borderWidth: primary ? 0 : 1, borderColor: colors.borderLight }}>
      {busy ? <ActivityIndicator size="small" color={primary ? colors.textInverse : tint} /> : <Icon name={icon} size={19} color={primary ? colors.textInverse : tint} />}
      <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: primary ? colors.textInverse : colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}
