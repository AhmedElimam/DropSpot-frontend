import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, fonts } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatEGP } from '@/utils/currency';
import type { BillingAlert } from '@/api/billingStatus';

/**
 * Home alert for a genuinely-overdue bill (not shielded by an allowance), styled
 * to the spec `.alert.d`: danger-wash banner, a white icon tile, an ink title and
 * a muted subtitle. Sits ABOVE the hero on purpose — a blocked check-in outranks
 * what's next. `showName` adds the child's name for the parent (multiple children).
 */
export function BillingOverdueCard({ alert, showName }: { alert: BillingAlert; showName?: boolean }) {
  const { t } = useTranslation();

  const subtitle = showName
    ? t('billing.overdue_desc_parent', { name: alert.student_name ?? '', amount: formatEGP(alert.amount) })
    : alert.blocking
      ? t('billing.overdue_blocking')
      : t('billing.overdue_desc', { amount: formatEGP(alert.amount) });

  return (
    <View
      style={{
        backgroundColor: colors.dangerWash, borderWidth: 1, borderColor: '#F5D6D4',
        borderRadius: 18, padding: 14, paddingHorizontal: 15,
        flexDirection: 'row', gap: spacing.md, alignItems: 'center',
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="warning" size={18} color={colors.danger} outline />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>
          {t('billing.overdue_title')}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
