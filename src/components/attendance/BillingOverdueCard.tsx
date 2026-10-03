import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, fonts } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatEGP } from '@/utils/currency';
import type { BillingAlert } from '@/api/billingStatus';

/**
 * Home alert for a genuinely-overdue bill (not shielded by an allowance). One compact row
 * (founder 2026-10-03: the alerts «take a huge chunk of the home screen»): the amount in the
 * title, one line of consequence, the teacher as a small tag. Danger tone because it can
 * block check-in; `blocking` says so in the line. `showName` adds the child's name (parent).
 */
export function BillingOverdueCard({ alert, showName }: { alert: BillingAlert; showName?: boolean }) {
  const { t } = useTranslation();
  const title = showName
    ? t('billing.overdue_desc_parent', { name: alert.student_name ?? '', amount: formatEGP(alert.amount) })
    : `${t('billing.overdue_title')} · ${formatEGP(alert.amount)}`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.dangerLight, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderStartWidth: 4, borderStartColor: colors.danger, minHeight: 60 }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="money" size={19} color={colors.dangerText} outline />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.dangerText }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.dangerText, marginTop: 1 }} numberOfLines={2}>
          {alert.blocking ? t('billing.overdue_blocking') : t('billing.overdue_desc', { amount: formatEGP(alert.amount) })}
          {alert.teacher_name ? ` · ${alert.teacher_name}` : ''}
        </Text>
      </View>
    </View>
  );
}
