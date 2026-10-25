import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { getSubscription, chooseSubscriptionPlan, sendPaidNotice, type SubscriptionState, type PaymentChannels } from '@/api/subscription';
import { formatDate, formatNumber } from '@/utils/format';
import { getFriendlyErrorMessage } from '@/utils/errors';

/**
 * The teacher's subscription, one panel for two screens: the settings page (with a back
 * button) and the wall a delinquent teacher lands on (without one). State comes from the
 * server on open; the login payload only seeds the first paint.
 */
export function SubscriptionPanel({ walled = false }: { walled?: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const seed = useAuthStore((s) => s.user?.subscription ?? null);
  const role = useAuthStore((s) => s.role);
  const isAssistant = role === 'assistant';
  const q = useQuery({ queryKey: ['teacher', 'subscription'], queryFn: getSubscription, staleTime: 60_000 });
  const state: SubscriptionState | null = q.data?.state ?? seed;
  const payment: Partial<PaymentChannels> = q.data?.payment ?? {};
  const [method, setMethod] = useState<'instapay' | 'vodafone_cash' | 'cash' | 'other'>('instapay');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  const plan = useMutation({
    mutationFn: (p: 'term' | 'annual') => chooseSubscriptionPlan(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher', 'subscription'] }),
  });
  const paid = useMutation({
    mutationFn: () => sendPaidNotice({ method, note: note.trim() || undefined }),
    onSuccess: (msg) => setSent(msg || t('subscription.paid_sent')),
  });

  if (!state) {
    return (
      <View style={{ padding: spacing.xl, alignItems: 'center' }}>
        {q.isLoading ? <ActivityIndicator color={colors.primary} /> : <Text style={{ fontFamily: fonts.regular, color: colors.textSecondary }}>{getFriendlyErrorMessage(q.error)}</Text>}
      </View>
    );
  }

  const p = state.prices;
  const phase = state.phase;
  const late = phase === 'late' || phase === 'blocked';
  const hasBill = phase === 'pending' || phase === 'late' || phase === 'blocked';
  const tone = phase === 'exempt' || phase === 'active' || phase === 'trial' ? colors.success : phase === 'pending' ? colors.warningDark : colors.danger;
  const toneBg = phase === 'exempt' || phase === 'active' || phase === 'trial' ? colors.successLight : phase === 'pending' ? colors.warningLight : colors.dangerLight;
  const termPrice = late ? p.late_term : p.term;
  const yearPrice = late ? p.late_year : p.year;
  const egp = (n: number | null | undefined) => `${formatNumber(Number(n ?? 0), { maximumFractionDigits: 0 })} ${t('subscription.egp')}`;
  const day = (d: string | null) => (d ? formatDate(d) : '—');

  const card = { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadows.sm } as const;
  const h = { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'right' as const };
  const body = { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'right' as const, lineHeight: 22 };

  return (
    <View style={{ gap: spacing.md }}>
      {walled ? (
        <View style={{ ...card, backgroundColor: colors.dangerLight, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
          <Icon name="lock" size={22} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...h, color: colors.dangerDark }}>{t('subscription.wall_title')}</Text>
            <Text style={{ ...body, color: colors.dangerDark }}>{isAssistant ? t('subscription.wall_assistant') : t('subscription.wall_body')}</Text>
          </View>
        </View>
      ) : null}

      {/* Phase */}
      <View style={card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ backgroundColor: toneBg, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: tone }}>{t(`subscription.phase_${phase}`)}</Text>
          </View>
          <Text style={h}>{t('subscription.title')}</Text>
        </View>
        <View style={{ marginTop: spacing.md, gap: 6 }}>
          {phase === 'trial' ? <Text style={body}>{state.trial_ends_at ? t('subscription.trial_ends', { date: day(state.trial_ends_at) }) : t('subscription.trial_days_left', { count: state.days_left ?? p.trial_days })}</Text> : null}
          {phase === 'active' ? <Text style={body}>{t('subscription.active_until', { date: day(state.expires_at) })}</Text> : null}
          {phase === 'exempt' ? <Text style={body}>{state.exempt_reason === 'founding' ? t('subscription.exempt_founding') : state.exempt_until ? t('subscription.exempt_until', { date: day(state.exempt_until) }) : t('subscription.exempt_forever')}</Text> : null}
          {hasBill ? (
            <>
              <Text style={body}>{t('subscription.issued_on', { date: day(state.due_at) })}</Text>
              <Text style={body}>{t('subscription.standard_until', { date: day(state.late_at) })}</Text>
              <Text style={{ ...body, color: colors.danger }}>{t('subscription.block_from', { date: day(state.block_at) })}</Text>
              {phase === 'pending' ? <Text style={{ ...body, fontFamily: fonts.medium }}>{t('subscription.days_to_late', { count: state.days_left ?? 0 })}</Text> : null}
              {phase === 'late' ? <Text style={{ ...body, fontFamily: fonts.medium, color: colors.danger }}>{t('subscription.days_to_block', { count: state.days_left ?? 0 })}</Text> : null}
            </>
          ) : null}
        </View>
      </View>

      {/* The open bill */}
      {hasBill && !isAssistant ? (
        <View style={card}>
          <Text style={h}>{t('subscription.bill_title')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 8, marginTop: spacing.sm }}>
            {late ? <View style={{ backgroundColor: colors.dangerLight, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.danger }}>{t('subscription.late_badge')}</Text></View> : null}
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{state.plan === 'annual' ? t('subscription.plan_year') : t('subscription.plan_term')}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 30, color: colors.textPrimary }}>{egp(state.price)}</Text>
          </View>

          <Text style={{ ...body, marginTop: spacing.md, fontFamily: fonts.medium, color: colors.textPrimary }}>{t('subscription.choose_plan')}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <PlanChoice selected={state.plan === 'annual'} title={t('subscription.plan_year')} price={egp(yearPrice)} sub={t('subscription.save_vs_terms', { amount: formatNumber(termPrice * 3 - yearPrice, { maximumFractionDigits: 0 }) })} busy={plan.isPending} onPress={() => plan.mutate('annual')} />
            <PlanChoice selected={state.plan !== 'annual'} title={t('subscription.plan_term')} price={egp(termPrice)} busy={plan.isPending} onPress={() => plan.mutate('term')} />
          </View>
          {plan.isError ? <Text style={{ ...body, color: colors.danger }}>{getFriendlyErrorMessage(plan.error)}</Text> : null}

          <Text style={{ ...h, marginTop: spacing.lg }}>{t('subscription.pay_title')}</Text>
          {payment.instapay_number ? <PayLine label={t('subscription.pay_instapay')} value={`${payment.instapay_number}${payment.instapay_name ? ` — ${payment.instapay_name}` : ''}`} /> : null}
          {payment.vodafone_number ? <PayLine label={t('subscription.pay_vodafone')} value={payment.vodafone_number} /> : null}
          {payment.support_phone ? <PayLine label={t('subscription.pay_support')} value={payment.support_phone} /> : null}

          {sent ? (
            <View style={{ backgroundColor: colors.successLight, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md }}>
              <Text style={{ ...body, color: colors.successDark ?? colors.success, fontFamily: fonts.medium }}>{sent}</Text>
            </View>
          ) : (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Text style={{ ...body, fontFamily: fonts.medium, color: colors.textPrimary }}>{t('subscription.paid_method')}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Chip label={t('subscription.pay_instapay')} on={method === 'instapay'} onPress={() => setMethod('instapay')} />
                <Chip label={t('subscription.pay_vodafone')} on={method === 'vodafone_cash'} onPress={() => setMethod('vodafone_cash')} />
                <Chip label="نقدًا" on={method === 'cash'} onPress={() => setMethod('cash')} />
                <Chip label="أخرى" on={method === 'other'} onPress={() => setMethod('other')} />
              </View>
              <TextInput value={note} onChangeText={setNote} placeholder={t('subscription.paid_note')} placeholderTextColor={colors.textTertiary} maxLength={300}
                style={{ fontFamily: fonts.regular, fontSize: 15, minHeight: 46, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingHorizontal: spacing.md, color: colors.textPrimary, textAlign: 'right', borderWidth: 1, borderColor: colors.border }} />
              <Button title={t('subscription.paid_button')} variant="success" onPress={() => paid.mutate()} loading={paid.isPending} />
              {paid.isError ? <Text style={{ ...body, color: colors.danger }}>{getFriendlyErrorMessage(paid.error)}</Text> : null}
              <Text style={{ ...body, fontSize: 12 }}>{t('subscription.paid_hint')}</Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Rules */}
      <View style={card}>
        <Text style={h}>{t('subscription.rules_title')}</Text>
        <View style={{ marginTop: spacing.sm, gap: 4 }}>
          <Rule text={t('subscription.rule_trial', { days: p.trial_days })} />
          <Rule text={t('subscription.rule_price', { term: formatNumber(p.term, { maximumFractionDigits: 0 }), year: formatNumber(p.year, { maximumFractionDigits: 0 }) })} />
          <Rule text={t('subscription.rule_grace', { days: p.grace_days })} />
          <Rule text={t('subscription.rule_late', { term: formatNumber(p.late_term, { maximumFractionDigits: 0 }), year: formatNumber(p.late_year, { maximumFractionDigits: 0 }) })} />
          <Rule text={t('subscription.rule_block', { days: p.block_days })} />
          <Rule text={t('subscription.rule_start')} />
        </View>
      </View>
    </View>
  );
}

function PlanChoice({ selected, title, price, sub, busy, onPress }: { selected: boolean; title: string; price: string; sub?: string; busy: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={busy} activeOpacity={0.85}
      style={{ flex: 1, borderRadius: radius.lg, borderWidth: 2, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.brandTint : colors.surface, padding: spacing.md, alignItems: 'flex-end', minHeight: 84 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: selected ? colors.primary : colors.textPrimary }}>{title}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginTop: 2 }}>{price}</Text>
      {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.success, marginTop: 2, textAlign: 'right' }}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

function PayLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text selectable style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{value}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{label}</Text>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: on ? colors.primary : colors.surfaceSunken, minHeight: 36, justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: on ? colors.textInverse : colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Rule({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, textAlign: 'right', lineHeight: 21 }}>{text}</Text>
      <Text style={{ fontFamily: fonts.bold, color: colors.accent, lineHeight: 21 }}>•</Text>
    </View>
  );
}
