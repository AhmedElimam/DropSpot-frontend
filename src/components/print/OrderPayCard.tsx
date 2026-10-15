import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Field, Input } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { formatNumber, formatShortDate, formatDateTime } from '@/utils/format';
import { OrderSection } from '@/components/print/OrderSection';
import { payMethodLabel } from '@/components/print/OrderReceipt';
import { payDueState, type PrintJob, type PrintOptions } from '@/api/print';

const STEPS: { key: PrintJob['payment_status']; icon: IconName }[] = [
  { key: 'unpaid', icon: 'invoices' },
  { key: 'claimed', icon: 'send' },
  { key: 'paid', icon: 'success' },
];

const METHODS: { key: string; icon: IconName }[] = [
  { key: 'instapay', icon: 'flash' },
  { key: 'vodafone_cash', icon: 'phone' },
  { key: 'bank', icon: 'invoices' },
  { key: 'cash', icon: 'money' },
];

/** Owed → proof sent → paid, as three dots on a line: done green, the current one lit. */
function PayWalk({ status }: { status: PrintJob['payment_status'] }) {
  const { t } = useTranslation();
  const idx = STEPS.findIndex((s) => s.key === status);
  const lit = status === 'unpaid' ? colors.warning : status === 'claimed' ? colors.brand : colors.success;
  return (
    <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, marginBottom: spacing.md }}>
      {STEPS.map((s, i) => {
        const done = i < idx || status === 'paid';
        const now = i === idx;
        const bg = done ? colors.success : now ? lit : colors.surface;
        return (
          <View key={s.key} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ width: '100%', height: 34, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i === 0 ? 'transparent' : i <= idx ? colors.success : colors.border }} />
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: bg, borderWidth: done || now ? 0 : 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={done && !now ? 'success' : s.icon} size={16} color={done || now ? colors.onPrimary : colors.textTertiary} />
              </View>
              <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i === STEPS.length - 1 ? 'transparent' : i < idx ? colors.success : colors.border }} />
            </View>
            <Text style={{ fontFamily: now ? fonts.bold : fonts.medium, fontSize: 11, color: now ? colors.textPrimary : colors.textSecondary, marginTop: 4, paddingHorizontal: 2, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {t(`print.pay_step_${s.key}`)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** One account to pay into: the number big enough to read and long-press to copy. */
function PayTo({ icon, label, number, name, chosen }: { icon: IconName; label: string; number: string; name?: string | null; chosen: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg,
      backgroundColor: chosen ? colors.brandTint : colors.surfaceSunken, borderWidth: 1.5, borderColor: chosen ? colors.brand : colors.borderLight }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: chosen ? colors.brand : colors.surface, borderWidth: chosen ? 0 : 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={19} color={chosen ? colors.onPrimary : colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary }}>{label}</Text>
        <Text selectable style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 25, color: colors.textPrimary, writingDirection: 'ltr', alignSelf: 'flex-start' }} numberOfLines={1}>{number}</Text>
        {name ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>{name}</Text> : null}
      </View>
    </View>
  );
}

/** One tinted line inside the card: an icon, a bold sentence, an optional softer one. */
function Note({ icon, tone, text, sub }: { icon: IconName; tone: { bg: string; fg: string }; text: string; sub?: string | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: tone.bg, marginBottom: spacing.sm }}>
      <Icon name={icon} size={17} color={tone.fg} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 19, color: tone.fg }}>{text}</Text>
        {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: tone.fg, opacity: 0.88 }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

/**
 * «السداد للمنصة»: where the money stands as a three-step walk; while it is owed, the amount,
 * the accounts to pay into, the method as icon tiles, the reference, the receipt's photo
 * (its thumbnail once picked) and the «I paid» button. Paid, it is one green line.
 *
 * «سجل الدفع» (2026-10-15): a PAY-FIRST job waiting for its money makes paying the point of
 * the card («ادفع علشان المطبعة تبدأ», and why it went pay-first); a credit job shows its
 * pay-by day, red once it has passed; a claim under review is one «بنراجع دفعك» line (the form
 * one tap away for a second receipt); a rejected claim says why, with the form open again.
 */
export function OrderPayCard({ j, payTo, method, onMethod, reference, onReference, proofUri, onPickProof, onClaim, busy }: {
  j: PrintJob;
  payTo: PrintOptions['pay_to'] | undefined;
  method: string;
  onMethod: (k: string) => void;
  reference: string;
  onReference: (v: string) => void;
  proofUri: string | null;
  onPickProof: () => void;
  onClaim: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const egp = t('teacher.egp');
  const paid = j.payment_status === 'paid';
  const claimed = j.payment_status === 'claimed';
  const prepay = !!j.awaits_prepayment;
  const rejected = j.payment_status === 'unpaid' ? j.claim_rejected_reason ?? null : null;
  const due = payDueState(j);
  // A claim under review folds the form away; «ابعت إيصال تاني» opens it for a second receipt.
  const [again, setAgain] = useState(false);
  useEffect(() => { setAgain(false); }, [j.claimed_at, j.payment_status]);
  const showForm = !paid && (!claimed || again);

  const danger = { bg: colors.dangerLight, fg: colors.dangerText };
  const title = prepay && !claimed ? t('print.credit_pay_first_title') : t('print.pay_title');
  const hint = paid ? t('print.paid_hint')
    : claimed ? (prepay ? t('print.credit_claim_review_prepay') : t('print.claimed_hint'))
    : prepay ? t('print.credit_pay_first_hint')
    : t('print.pay_hint');
  const tint = paid ? { bg: colors.successLight, fg: colors.successText }
    : rejected || due === 'late' ? danger
    : prepay && !claimed ? { bg: colors.accentLight, fg: colors.accentText }
    : { bg: colors.warningLight, fg: colors.warningText };

  return (
    <OrderSection icon={prepay && !claimed ? 'print' : 'invoices'} title={title} hint={hint} tint={tint}>
      <PayWalk status={j.payment_status} />

      {rejected ? <Note icon="error" tone={danger} text={t('print.credit_claim_rejected', { reason: rejected })} sub={t('print.credit_claim_rejected_hint')} /> : null}
      {prepay && !claimed && j.pay_first_reason ? (
        <Note icon="info" tone={{ bg: colors.surfaceSunken, fg: colors.textSecondary }} text={t('print.credit_why_prepay')} sub={j.pay_first_reason} />
      ) : null}
      {due !== 'none' && j.pay_due_at ? (
        <Note icon={due === 'late' ? 'warning' : 'calendar'} tone={due === 'late' ? danger : { bg: colors.warningLight, fg: colors.warningText }}
          text={due === 'late' ? t('print.credit_pay_late', { at: formatShortDate(j.pay_due_at) }) : t('print.credit_pay_by', { at: formatShortDate(j.pay_due_at) })} />
      ) : null}
      {claimed && !again ? (
        <View style={{ padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandTint }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="clock" size={18} color={colors.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.brand }}>{t('print.credit_claim_review')}</Text>
              {j.claimed_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>{t('print.credit_claim_review_hint', { at: formatDateTime(j.claimed_at) })}</Text> : null}
            </View>
          </View>
          <TouchableOpacity onPress={() => setAgain(true)} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{t('print.credit_claim_again')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {paid ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.successLight }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="success" size={22} color={colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.successText }}>{t('print.paid_line', { amount: formatNumber(j.total, { maximumFractionDigits: 2 }), egp })}</Text>
            {payMethodLabel(j.payment_method, t) ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.successText, opacity: 0.85 }}>{t('print.order_paid_via', { m: payMethodLabel(j.payment_method, t) })}</Text> : null}
          </View>
        </View>
      ) : showForm ? (
        <>
          {/* What to send */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.accentLight, marginBottom: spacing.sm }}>
            <Icon name="money" size={18} color={colors.accentText} />
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.accentText }}>{t('print.pay_amount_due')}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.accentText }}>{`${formatNumber(j.total, { maximumFractionDigits: 2 })} ${egp}`}</Text>
          </View>

          {payTo?.instapay?.number || payTo?.vodafone_cash ? (
            <View style={{ gap: spacing.sm }}>
              {payTo?.instapay?.number ? <PayTo icon="flash" label={t('print.pay_instapay')} number={payTo.instapay.number} name={payTo.instapay.name} chosen={method === 'instapay'} /> : null}
              {payTo?.vodafone_cash ? <PayTo icon="phone" label={t('print.pay_vodafone')} number={payTo.vodafone_cash} chosen={method === 'vodafone_cash'} /> : null}
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{t('print.pay_hold_copy')}</Text>
            </View>
          ) : null}

          <Field label={t('print.method')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {METHODS.map((m) => {
                const on = method === m.key;
                return (
                  <TouchableOpacity key={m.key} onPress={() => onMethod(m.key)} accessibilityRole="button" accessibilityState={{ selected: on }} activeOpacity={0.8}
                    style={{ flexBasis: '45%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 48, paddingHorizontal: spacing.md, borderRadius: radius.lg,
                      backgroundColor: on ? colors.brand : colors.surfaceSunken, borderWidth: 1, borderColor: on ? colors.brand : colors.border }}>
                    <Icon name={m.icon} size={17} color={on ? colors.onPrimary : colors.brand} />
                    <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13.5, color: on ? colors.onPrimary : colors.textPrimary }} numberOfLines={1}>{payMethodLabel(m.key, t)}</Text>
                    {on ? <Icon name="success" size={16} color={colors.onPrimary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          <Field label={t('print.reference')}><Input value={reference} onChangeText={onReference} placeholder={t('print.reference_ph')} maxLength={60} /></Field>

          <Field label={t('print.proof')}>
            <TouchableOpacity onPress={onPickProof} accessibilityRole="button" activeOpacity={0.8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: proofUri ? 'solid' : 'dashed',
                borderColor: proofUri ? colors.success : colors.borderStrong, backgroundColor: proofUri ? colors.successLight : colors.surfaceSunken }}>
              {proofUri ? (
                <Image source={{ uri: proofUri }} style={{ width: 56, height: 56, borderRadius: radius.md }} contentFit="cover" transition={120} accessibilityIgnoresInvertColors />
              ) : (
                <View style={{ width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="image" size={24} color={colors.brand} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: proofUri ? colors.successText : colors.textPrimary }}>{proofUri ? t('print.proof_ready') : t('print.proof_pick')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 17, color: colors.textSecondary }}>{proofUri ? t('print.proof_change') : t('print.proof_pick_hint')}</Text>
              </View>
              <Icon name={proofUri ? 'refresh' : 'back'} size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </Field>

          <Button title={t('print.claim')} onPress={onClaim} loading={busy} variant={prepay ? 'accent' : 'primary'} style={{ marginTop: spacing.lg }} />
        </>
      ) : null}
    </OrderSection>
  );
}
