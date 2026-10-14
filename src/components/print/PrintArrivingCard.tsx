import { View, Text, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { ShopLogo } from '@/components/print/ShopLogo';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { getReceiveJobs } from '@/api/print';

/**
 * «طباعة في الطريق للسنتر» — on the home of an assistant the teacher gave «receive_prints»
 * (founder 2026-10-14: «teacher or assistant»): the teacher's prints being made, ready or with
 * a driver, each opening the order page in receiving mode (the trip, the code, sharing where
 * you are — never the money). The teacher has the «المطبعة» tab for this; nothing shows there.
 */
export function PrintArrivingCard() {
  const { t } = useTranslation();
  const { isAssistant, can } = useActiveAbilities();
  const flags = useFeatureFlags().data;
  const on = isAssistant && can(ABILITY.RECEIVE_PRINTS) && !!flags?.print_market;
  const jobs = useQuery({ queryKey: ['print-receive'], queryFn: getReceiveJobs, enabled: on, refetchInterval: 60_000 });
  const list = (jobs.data ?? []).slice(0, 3);
  if (!on || list.length === 0) return null;

  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="print" size={16} color={colors.accentText} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('print.arriving_title')}</Text>
      </View>
      {list.map((j) => {
        const moving = !!j.delivery?.is_active;
        return (
          <TouchableOpacity key={j.id} onPress={() => router.push(`/(teacher)/print/${j.id}` as Href)} activeOpacity={0.88} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: moving ? colors.accent : colors.border, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm }}>
            <ShopLogo logo={j.shop.logo ?? null} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }} numberOfLines={1}>{j.title}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: moving ? colors.accentText : colors.textSecondary }} numberOfLines={1}>
                {moving ? (j.delivery?.driver ? t('print.tab_driver', { name: j.delivery.driver }) : j.delivery?.label) : j.status_label}
              </Text>
            </View>
            {moving ? <Icon name="delivery" size={18} color={colors.accent} /> : null}
            <Icon name="back" size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
