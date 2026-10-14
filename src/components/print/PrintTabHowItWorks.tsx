import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';

/**
 * First time on the tab (no jobs yet): how a print goes, as three pictures joined by a
 * dashed path — pick a shop, put the PDF up, follow it to the door.
 */
export function PrintTabHowItWorks() {
  const { t } = useTranslation();
  const steps: { icon: IconName; label: string; sub: string; bg: string; fg: string }[] = [
    { icon: 'storefront', label: t('print.how_1'), sub: t('print.tab_how_1_sub'), bg: colors.brandTint, fg: colors.brand },
    { icon: 'document', label: t('print.how_2'), sub: t('print.tab_how_2_sub'), bg: colors.accentLight, fg: colors.accentText },
    { icon: 'delivery', label: t('print.how_3'), sub: t('print.tab_how_3_sub'), bg: colors.successLight, fg: colors.successText },
  ];
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadows.sm }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('print.tab_how_title')}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 2 }}>{t('print.empty_hint')}</Text>
      <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
        {steps.map((s, i) => (
          <View key={s.label} style={{ flex: 1, alignItems: 'center' }}>
            {/* the path between pictures */}
            {i > 0 ? (
              <View style={{ position: 'absolute', top: 31, start: '-12%', end: '88%', flexDirection: 'row', justifyContent: 'space-between' }}>
                {[0, 1, 2, 3].map((k) => <View key={k} style={{ width: 4, height: 2, borderRadius: 1, backgroundColor: colors.borderStrong }} />)}
              </View>
            ) : null}
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={s.icon} size={28} color={s.fg} />
              <View style={{ position: 'absolute', top: -2, end: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: s.fg, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, lineHeight: 15, color: colors.surface }}>{formatNumber(i + 1)}</Text>
              </View>
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }} numberOfLines={1}>{s.label}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: colors.textTertiary, textAlign: 'center', paddingHorizontal: 4 }} numberOfLines={2}>{s.sub}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
