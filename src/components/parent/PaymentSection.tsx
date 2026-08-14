import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, fonts } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { PaymentProofButton } from '@/components/parent/PaymentProofButton';
import type { Invoice } from '@/api/invoices';

/**
 * The per-invoice payment affordance, shared by the parent and student invoice
 * lists. When the teacher has configured at least one digital method (Vodafone
 * Cash / InstaPay) it offers the remote-transfer + screenshot-proof flow; when
 * none are enabled the invoice is cash/physical only, so no digital section shows
 * — just a cash note. Paid invoices render nothing.
 */
export function PaymentSection({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();

  if (invoice.status === 'paid') return null;

  const hasDigital = (invoice.payment_methods?.length ?? 0) > 0;

  return (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      {hasDigital ? (
        // TEMP/INTERIM (Paymob blocked): remote transfer + screenshot proof.
        <PaymentProofButton invoice={invoice} />
      ) : (
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
            borderRadius: radius.md, padding: spacing.md,
          }}
        >
          <Icon name="money" size={18} color={colors.textSecondary} outline />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
            {t('invoices.cash_only')}
          </Text>
        </View>
      )}
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
        {t('invoices.pay_hint')}
      </Text>
    </View>
  );
}
