import { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import type { BoardShop } from '@/api/print';

const money = (v: number) => formatNumber(v, { maximumFractionDigits: 2 });
const shopKey = (x: BoardShop) => String(x.vendor_id);

/** One other shop's price for the same job: the total, how it compares, how fast, its rating. */
const CompareCard = memo(function CompareCard({ x, mine, egp, onPick }: { x: BoardShop; mine: number; egp: string; onPick: (vendorId: number) => void }) {
  const { t } = useTranslation();
  const d = Math.round(((x.quote.total ?? 0) - mine) * 100) / 100;
  const tone = d < 0 ? colors.successText : d > 0 ? colors.textTertiary : colors.textSecondary;
  return (
    <TouchableOpacity onPress={() => onPick(x.vendor_id)} activeOpacity={0.85} accessibilityRole="button"
      style={{ width: 150, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: d < 0 ? colors.success : colors.border, padding: spacing.sm }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>{x.name}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, marginTop: 2 }}>{money(x.quote.total ?? 0)} <Text style={{ fontSize: 11, color: colors.textTertiary }}>{egp}</Text></Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: tone }}>{d < 0 ? t('print.compare_cheaper', { d: money(-d) }) : d > 0 ? t('print.compare_pricier', { d: money(d) }) : t('print.compare_same')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <Icon name="clock" size={11} color={colors.textTertiary} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>{t('print.within_hours', { h: formatNumber(x.turnaround_hours) })}</Text>
        {x.rating != null ? <><View style={{ width: 1, height: 10, backgroundColor: colors.border, marginHorizontal: 2 }} /><Icon name="star" size={11} color={colors.warning} /><Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>{formatNumber(x.rating, { maximumFractionDigits: 1 })}</Text></> : null}
      </View>
    </TouchableOpacity>
  );
});

/**
 * «نفس الطلب عند مطابع أخرى» — the composer's strip of what the same job costs elsewhere
 * (inDrive's «other offers»): a windowed horizontal list, one card a shop; a tap switches shop.
 */
export function PrintCompareStrip({ shops, mine, egp, onPick }: { shops: BoardShop[]; mine: number; egp: string; onPick: (vendorId: number) => void }) {
  const renderCard = useCallback(({ item }: { item: BoardShop }) => <CompareCard x={item} mine={mine} egp={egp} onPick={onPick} />, [mine, egp, onPick]);
  return (
    <FlatList horizontal data={shops} keyExtractor={shopKey} renderItem={renderCard}
      initialNumToRender={4} maxToRenderPerBatch={4} windowSize={5}
      showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} />
  );
}
