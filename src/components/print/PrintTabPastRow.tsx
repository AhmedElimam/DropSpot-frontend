import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { ShopLogo } from '@/components/print/ShopLogo';
import { formatNumber, formatShortDate } from '@/utils/format';
import type { PrintJob } from '@/api/print';
import { toneTint } from '@/components/print/PrintTabJobCard';

const money = (v: number) => formatNumber(v, { maximumFractionDigits: v % 1 ? 2 : 0 });

/**
 * A finished job as a tidy row: the shop's face, what it was, when and for how much, and —
 * once it reached the teacher — «اطبع تاني» one tap away. `onAgain` is the tab's reorder.
 */
export function PrintTabPastRow({ j, last, busy, onAgain }: { j: PrintJob; last: boolean; busy: boolean; onAgain: () => void }) {
  const { t } = useTranslation();
  const when = j.received_at ?? j.cancelled_at ?? j.delivered_at ?? j.sent_at;
  const tint = toneTint(j.status_tone);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.borderLight }}>
      <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} onPress={() => router.push(`/(teacher)/print/${j.id}` as Href)} accessibilityRole="button" activeOpacity={0.8}>
        <ShopLogo logo={j.shop.logo} size={42} muted={j.status === 'cancelled' || j.status === 'declined'} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{j.title}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>{j.shop.name ?? ''}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {when ? <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary }}>{formatShortDate(when)}</Text> : null}
            {when ? <View style={{ width: 1, height: 12, backgroundColor: colors.border }} /> : null}
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary }}>{money(j.total)} {t('teacher.egp')}</Text>
          </View>
        </View>
      </TouchableOpacity>
      {j.status === 'received' ? (
        <TouchableOpacity onPress={onAgain} disabled={busy} accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 34, borderRadius: radius.full, backgroundColor: colors.brandTint, opacity: busy ? 0.6 : 1 }}>
          {busy ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon name="refresh" size={14} color={colors.brand} />}
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('print.again')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ backgroundColor: tint.bg, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: tint.fg }} numberOfLines={1}>{j.status_label}</Text>
        </View>
      )}
    </View>
  );
}
