import { View, Text, TouchableOpacity, ActivityIndicator, FlatList, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { SheetModal } from '@/components/ui/SheetModal';
import { GeneratedAvatar } from '@/components/ui/GeneratedAvatar';
import { Alert } from '@/ui/dialog';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useBlockCommunityMember, useCommunityBlocks } from '@/hooks/useCommunity';

/**
 * «المحظورون» — the members this person blocked, each with «إلغاء الحظر». Blocking is personal:
 * it hides their posts and comments for this person only, and they are never told (the
 * guard-rails spec §7). Unblocking brings their rows back on the next refetch.
 */
export function BlockedSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const blocks = useCommunityBlocks(visible);
  const toggle = useBlockCommunityMember();
  const rows = blocks.data ?? [];

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="block" size={21} color={colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('community_space.blocked_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }}>{t('community_space.blocked_hint')}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight }}>
          <Icon name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <FlatList
        style={{ maxHeight: Math.round(height * 0.5) }}
        data={rows}
        keyExtractor={(b) => String(b.user_id)}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
            <GeneratedAvatar seed={item.avatar_seed} size={38} label={item.name} />
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }} numberOfLines={1}>{item.name}</Text>
            <TouchableOpacity
              onPress={() => toggle.mutate({ userId: item.user_id, block: false }, { onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) })}
              disabled={toggle.isPending} activeOpacity={0.8} accessibilityRole="button"
              style={{ height: 34, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{t('community_space.unblock')}</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={blocks.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} /> : (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textTertiary, textAlign: 'center', marginVertical: spacing.xl }}>{t('community_space.blocked_empty')}</Text>
        )}
        showsVerticalScrollIndicator={false}
        windowSize={5}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
      />
    </SheetModal>
  );
}
