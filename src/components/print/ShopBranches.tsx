import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import type { ShopBranch } from '@/api/print';

/**
 * «الفروع» on a shop's page (founder 2026-10-14: print shops have branches): every open branch,
 * nearest first — the nearest marked «الأقرب ليك» — with its address, how far, its own hours,
 * and a call and a map button each. Only when the shop has more than one.
 */
export function ShopBranches({ branches }: { branches: ShopBranch[] }) {
  const { t } = useTranslation();
  if (branches.length < 2) return null;
  const nearestKnown = branches[0]?.distance_km != null;

  return (
    <View style={{ gap: 8 }}>
      {branches.map((b, i) => {
        const near = i === 0 && nearestKnown;
        return (
          <View key={b.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: near ? colors.accentLight : colors.surfaceSunken, borderWidth: near ? 1.5 : 1, borderColor: near ? colors.accent : colors.borderLight }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: b.is_main ? colors.accent : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="location" size={18} color={b.is_main ? colors.onAccent : colors.brand} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }} numberOfLines={1}>{b.name}</Text>
                {near ? (
                  <View style={{ paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: colors.accent, justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: colors.onAccent }}>{t('print.branch_nearest')}</Text>
                  </View>
                ) : null}
                {b.is_main ? (
                  <View style={{ paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: colors.surface, justifyContent: 'center', borderWidth: 1, borderColor: colors.borderLight }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: colors.textSecondary }}>{t('print.branch_main')}</Text>
                  </View>
                ) : null}
              </View>
              {b.address ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }} numberOfLines={2}>{b.address}</Text> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {b.distance_km != null ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: near ? colors.accentText : colors.textSecondary }}>{t('print.km_away', { km: formatNumber(b.distance_km, { maximumFractionDigits: 1 }) })}</Text> : null}
                {b.distance_km != null && b.hours_note ? <View style={{ width: 1, height: 12, backgroundColor: colors.border }} /> : null}
                {b.hours_note ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>{b.hours_note}</Text> : null}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              {b.lat != null && b.lng != null ? (
                <TouchableOpacity onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`)} accessibilityRole="button" accessibilityLabel={t('print.shop_open_in_maps')}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderLight }}>
                  <Icon name="gps" size={16} color={colors.brand} />
                </TouchableOpacity>
              ) : null}
              {b.phone ? (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${b.phone}`)} accessibilityRole="button" accessibilityLabel={t('print.call')}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="call" size={16} color={colors.successText} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
