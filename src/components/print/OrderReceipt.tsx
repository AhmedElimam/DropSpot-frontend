import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, gradients, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { OrderSection } from '@/components/print/OrderSection';
import type { PrintJob } from '@/api/print';

/** The payment method's words, shared by the receipt and the pay card. */
export function payMethodLabel(key: string | null | undefined, t: (k: string) => string): string | null {
  switch (key) {
    case 'instapay': return t('print.pay_instapay');
    case 'vodafone_cash': return t('print.pay_vodafone');
    case 'bank': return t('print.method_bank');
    case 'cash': return t('print.method_cash');
    default: return null;
  }
}

/** The payment state's colours: green paid, navy claimed, amber owed. */
export function payTone(status: PrintJob['payment_status']): { bg: string; fg: string } {
  return status === 'paid' ? { bg: colors.successLight, fg: colors.successText }
    : status === 'claimed' ? { bg: colors.brandTint, fg: colors.brand }
    : { bg: colors.warningLight, fg: colors.warningText };
}

function Line({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone?: 'good' | 'accent' }) {
  const tint = tone === 'good' ? { bg: colors.successLight, fg: colors.successText } : tone === 'accent' ? { bg: colors.accentLight, fg: colors.accentText } : { bg: colors.surfaceSunken, fg: colors.textSecondary };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 7 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={14} color={tint.fg} />
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: tone === 'good' ? colors.successText : colors.textPrimary }}>{value}</Text>
    </View>
  );
}

/** The torn edge: a notch bitten out of each side and a dashed line between them. */
function Tear() {
  const notch = { position: 'absolute' as const, top: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border };
  return (
    <View style={{ height: 22, justifyContent: 'center', marginHorizontal: -spacing.lg, marginVertical: spacing.sm }}>
      <View style={{ marginHorizontal: spacing.lg, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong }} />
      <View style={[notch, { start: -12 }]} />
      <View style={[notch, { end: -12 }]} />
    </View>
  );
}

/**
 * «الحساب» as a receipt: each line with a soft icon, a torn edge, then the total in a navy
 * band with how it was paid. The payment state rides in the head as a pill.
 */
export function OrderReceipt({ j }: { j: PrintJob }) {
  const { t } = useTranslation();
  const egp = t('teacher.egp');
  const money = (v: number) => `${formatNumber(v, { maximumFractionDigits: 2 })} ${egp}`;
  const tone = payTone(j.payment_status);
  const via = j.payment_status !== 'unpaid' ? payMethodLabel(j.payment_method, t) : null;

  return (
    <OrderSection icon="money" title={t('print.money')} tint={{ bg: colors.successLight, fg: colors.successText }} clip
      end={j.payment_label ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: radius.full, backgroundColor: tone.bg }}>
          <Icon name={j.payment_status === 'paid' ? 'success' : j.payment_status === 'claimed' ? 'clock' : 'warning'} size={13} color={tone.fg} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: tone.fg }}>{j.payment_label}</Text>
        </View>
      ) : undefined}>
      <Line icon="print" label={t('print.line_pages', { copies: formatNumber(j.copies), pages: formatNumber(j.pages), p: formatNumber(j.price_per_page, { maximumFractionDigits: 2 }) })} value={money(j.pages * j.copies * j.price_per_page)} />
      {(j.discount ?? 0) > 0 ? <Line icon="pricetag" tone="good" label={t('print.line_discount_plain')} value={`− ${money(j.discount ?? 0)}`} /> : null}
      {j.finish_per_copy > 0 ? <Line icon="book" label={t('print.line_finish', { copies: formatNumber(j.copies), p: formatNumber(j.finish_per_copy, { maximumFractionDigits: 2 }) })} value={money(j.copies * j.finish_per_copy)} /> : null}
      {(j.extras ?? []).map((x) => <Line key={x.id} icon="add" label={x.name} value={money(x.amount)} />)}
      {(j.rush_fee ?? 0) > 0 ? <Line icon="flash" tone="accent" label={t('print.line_rush_plain')} value={money(j.rush_fee ?? 0)} /> : null}
      {j.delivery_fee > 0 ? <Line icon="delivery" label={t('print.line_delivery')} value={money(j.delivery_fee)} /> : null}
      {j.platform_fee > 0 ? <Line icon="shield" label={t('print.line_fee')} value={money(j.platform_fee)} /> : null}

      <Tear />

      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: -40, end: -30, width: 110, height: 110, borderRadius: 55, backgroundColor: colors.onPrimary, opacity: 0.08 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.onPrimary }}>{t('print.total')}</Text>
            {via ? <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.onPrimary, opacity: 0.8, marginTop: 1 }} numberOfLines={1}>{t('print.order_paid_via', { m: via })}</Text> : null}
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 34, color: colors.onPrimary }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{money(j.total)}</Text>
        </View>
      </LinearGradient>
    </OrderSection>
  );
}
