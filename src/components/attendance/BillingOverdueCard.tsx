import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, fonts } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatEGP } from '@/utils/currency';
import type { BillingAlert } from '@/api/billingStatus';

/**
 * Home banner for a genuinely-overdue bill (not shielded by an allowance). Danger
 * tone because it can block check-in; when `blocking` is true it says so explicitly.
 * `showName` adds the child's name for the parent (multiple children).
 */
export function BillingOverdueCard({ alert, showName }: { alert: BillingAlert; showName?: boolean }) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        backgroundColor: colors.dangerLight, borderWidth: 1, borderColor: colors.danger,
        borderRadius: radius.xl, padding: spacing.xl, borderStartWidth: 4, borderStartColor: colors.danger,
        flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
      }}
    >
      <Icon name="money" size={22} color={colors.dangerText} outline />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.dangerText }}>
          {t('billing.overdue_title')}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.dangerText, marginTop: 4 }}>
          {showName
            ? t('billing.overdue_desc_parent', { name: alert.student_name ?? '', amount: formatEGP(alert.amount) })
            : t('billing.overdue_desc', { amount: formatEGP(alert.amount) })}
        </Text>
        {alert.blocking ? (
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: colors.dangerText, marginTop: 2 }}>
            {t('billing.overdue_blocking')}
          </Text>
        ) : null}
        {alert.teacher_name ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Icon name="teacher" size={14} color={colors.dangerText} outline style={{ marginEnd: 3 }} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.dangerText }}>{alert.teacher_name}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
