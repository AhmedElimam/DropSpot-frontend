import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SheetModal } from '@/components/ui/SheetModal';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useCommunityShareLink } from '@/hooks/useCommunity';
import type { CommunityPost } from '@/api/community';

/**
 * «مشاركة» a community post (founder 2026-10-29): the post's public link — drosspot.app/c/… —
 * which opens a small page with the live post under a «حمّل التطبيق» card. The server decides
 * what that page shows: a students'-community post is a locked card there, nothing of the
 * child, so the sheet says so instead of pretending it is public.
 *
 * Core React Native only (Share, Linking): no clipboard module, nothing native — OTA-safe. The
 * link is selectable, so a long press copies it.
 */
export function ShareSheet({ post, onClose }: { post: CommunityPost | null; onClose: () => void }) {
  const { t } = useTranslation();
  const link = useCommunityShareLink(post?.id ?? null);
  const locked = post?.audience === 'students' && post.author.role !== 'staff';
  const data = link.data;

  const shareAll = async () => {
    if (!data) return;
    try {
      await Share.share({ message: data.text, title: data.title });
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
            <Action icon="share" tint={colors.brand} label={t('community_space.share_more')} onPress={shareAll} primary />
          </View>
        </>
      )}
    </SheetModal>
  );
}

function Action({ icon, tint, label, onPress, primary }: { icon: IconName; tint: string; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={label}
      style={{ flex: 1, height: 50, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: primary ? colors.brand : colors.surface, borderWidth: primary ? 0 : 1, borderColor: colors.borderLight }}>
      <Icon name={icon} size={19} color={primary ? colors.textInverse : tint} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: primary ? colors.textInverse : colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}
