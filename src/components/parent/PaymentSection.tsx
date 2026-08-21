import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, fonts } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { PaymentProofButton } from '@/components/parent/PaymentProofButton';
import type { Invoice } from '@/api/invoices';

/**
 * The per-invoice payment affordance, shared by the parent and student invoice
 * lists. Shows each channel the teacher offers: any configured digital method
 * (Vodafone Cash / InstaPay) via the remote-transfer + screenshot-proof flow, and
 * a "pay in person / cash" note when physical is accepted (the default when no
 * digital method is enabled). Paid invoices render nothing.
 */
export function PaymentSection({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();

  if (invoice.status === 'paid') return null;

  // Gate the transfer + proof flow on the teacher's digital SWITCH, not on whether
  // a number is filled: an enabled-but-blank method must still offer the transfer
  // (and proof upload) — not fall back to "physical only". `payment_methods` is the
  // pre-fix fallback for older payloads without the accepts_digital signal.
  const hasDigital = invoice.accepts_digital === true || (invoice.payment_methods?.length ?? 0) > 0;
  // Default true — an invoice always offers at least one way to pay.
  const acceptsPhysical = invoice.accepts_physical !== false;

  return (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      {hasDigital ? (
        // TEMP/INTERIM (Paymob blocked): remote transfer + screenshot proof.
        <PaymentProofButton invoice={invoice} />
      ) : null}

      {acceptsPhysical ? (
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
            borderRadius: radius.md, padding: spacing.md,
          }}
        >
          <Icon name="money" size={18} color={colors.textSecondary} outline />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
            {t(hasDigital ? 'invoices.cash_also' : 'invoices.cash_only')}
          </Text>
        </View>
      ) : null}

      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
        {t('invoices.pay_hint')}
      </Text>
    </View>
  );
}
