import { View, Text, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { CreditRing, creditTint, egpAmount } from '@/components/print/CreditBits';
import type { PrintCredit } from '@/api/print';

/**
 * «سجل الدفع» on the print tab, small: the score ring, the tier, and one line — what is left
 * on credit, that sends go pay-first, or (red) what is overdue. Opens the record. Teacher only:
 * the tab wraps it in a teacher-only surface.
 */
export function PrintTabCreditCard({ c }: { c: PrintCredit }) {
  const { t } = useTranslation();
  const egp = t('teacher.egp');
  const tint = creditTint(c.tone);
  const overdue = c.money.overdue_count > 0;
  const prepay = c.tier === 'weak' || c.tier === 'frozen';
  const line = overdue ? t('print.credit_card_overdue', { amount: egpAmount(c.money.overdue), egp })
    : prepay ? t('print.credit_card_prepay')
    : t('print.credit_card_available', { amount: egpAmount(c.money.available), egp });

  return (
    <TouchableOpacity onPress={() => router.push('/(teacher)/print/credit' as Href)} activeOpacity={0.9} accessibilityRole="button"
      accessibilityLabel={`${t('print.credit_title')}، ${t('print.credit_score_a11y', { score: formatNumber(c.score), tier: c.tier_label })}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, ...shadows.sm,
        backgroundColor: overdue ? colors.dangerLight : colors.surface, borderWidth: overdue ? 1.5 : 1, borderColor: overdue ? colors.danger : colors.border }}>
      <CreditRing score={c.score} tone={c.tone} size={58} stroke={6} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }}>{t('print.credit_title')}</Text>
          <View style={{ paddingHorizontal: 9, height: 22, borderRadius: 11, backgroundColor: tint.bg, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: tint.fg }}>{c.tier_label}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name={overdue ? 'warning' : prepay ? 'clock' : 'money'} size={14} color={overdue ? colors.dangerText : prepay ? colors.warningText : colors.textSecondary} />
          <Text style={{ flex: 1, fontFamily: overdue ? fonts.bold : fonts.medium, fontSize: 12.5, lineHeight: 18, color: overdue ? colors.dangerText : prepay ? colors.warningText : colors.textSecondary }} numberOfLines={2}>{line}</Text>
        </View>
      </View>
      <Icon name="back" size={18} color={overdue ? colors.dangerText : colors.textTertiary} />
    </TouchableOpacity>
  );
}
