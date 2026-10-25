import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { useRose } from '@/hooks/useRose';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { getSubscription, chooseSubscriptionPlan, sendPaidNotice, type SubscriptionState, type PaymentChannels } from '@/api/subscription';
import { formatDate, formatNumber } from '@/utils/format';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { subscriptionSheet } from './receipt';
import { SubscriptionSheetView } from './SubscriptionSheetView';

/**
 * The teacher's subscription, one panel for two screens: the settings page (with a back
 * button) and the wall a delinquent teacher lands on (without one). State comes from the
 * server on open; the login payload only seeds the first paint.
 *
 * Founder 2026-10-25 («some love on the subscription page, list the features»): a hero with
 * where it stands, مدام روز's stamped sheet, what the subscription includes, the two plans,
 * how to pay while a bill is open, and the rules. Laid out for the app's forced RTL: rows
 * with `row`, no `textAlign: 'right'` (RN swaps it to the left), bullets at the start.
 */
export function SubscriptionPanel({ walled = false }: { walled?: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const rose = useRose();
  const { data: flags } = useFeatureFlags();
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
  const canChoose = hasBill && !isAssistant;
  const termPrice = late ? p.late_term : p.term;
  const yearPrice = late ? p.late_year : p.year;
  const n = (v: number | null | undefined) => formatNumber(Number(v ?? 0), { maximumFractionDigits: 0 });
  const egp = (v: number | null | undefined) => `${n(v)} ${t('subscription.egp')}`;
  const day = (d: string | null | undefined) => (d ? formatDate(d) : '—');
  const sheet = subscriptionSheet(state, t);

  const chip = phase === 'exempt' || phase === 'active' || phase === 'trial'
    ? { fg: colors.successText, bg: colors.successLight }
    : phase === 'pending' || phase === 'lapsed' ? { fg: colors.warningText, bg: colors.warningLight } : { fg: colors.dangerText, bg: colors.dangerLight };
  const heroLine = phase === 'trial' ? t('subscription.hero_trial', { count: state.days_left ?? p.trial_days })
    : phase === 'active' ? t('subscription.hero_active', { date: day(state.expires_at) })
    : phase === 'exempt' ? t('subscription.hero_exempt')
    : hasBill ? t('subscription.hero_bill', { price: n(state.price) })
    : t('subscription.hero_lapsed');
  const trialUsed = phase === 'trial' && p.trial_days > 0 ? Math.min(p.trial_days, Math.max(0, p.trial_days - (state.days_left ?? p.trial_days))) : 0;

  const features: { icon: IconName; key: string; tint: string; bg: string }[] = [
    { icon: 'scan', key: 'attendance', tint: colors.brand, bg: colors.brandTint },
    { icon: 'calendar', key: 'sessions', tint: colors.accent, bg: colors.accentLight },
    { icon: 'invoices', key: 'billing', tint: colors.success, bg: colors.successLight },
    { icon: 'money', key: 'rose', tint: colors.brand, bg: colors.brandTint },
    { icon: 'children', key: 'families', tint: colors.accent, bg: colors.accentLight },
    { icon: 'teacher', key: 'assistants', tint: colors.success, bg: colors.successLight },
    ...(flags?.revise_mode ? [{ icon: 'trophy' as IconName, key: 'revision', tint: colors.accent, bg: colors.accentLight }] : []),
    { icon: 'card', key: 'cards', tint: colors.brand, bg: colors.brandTint },
    { icon: 'reports', key: 'web', tint: colors.success, bg: colors.successLight },
    { icon: 'whatsapp', key: 'support', tint: colors.accent, bg: colors.accentLight },
  ];

  const card = { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadows.sm } as const;
  const h = { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary } as const;
  const body = { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 22 } as const;

  return (
    <View style={{ gap: spacing.md }}>
      {walled ? (
        <View style={{ ...card, backgroundColor: colors.dangerLight, borderColor: colors.dangerLight, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
          <Icon name="lock" size={22} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...h, color: colors.dangerText }}>{t('subscription.wall_title')}</Text>
            <Text style={{ ...body, color: colors.dangerText }}>{isAssistant ? t('subscription.wall_assistant') : t('subscription.wall_body')}</Text>
          </View>
        </View>
      ) : null}

      {/* Where it stands */}
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: spacing.lg, ...shadows.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="card" size={20} color="#FFFFFF" />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: 'rgba(255,255,255,0.86)' }} numberOfLines={1}>{t('subscription.title')}</Text>
          <View style={{ backgroundColor: chip.bg, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: chip.fg }}>{t(`subscription.phase_${phase}`)}</Text>
          </View>
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 36, color: '#FFFFFF', marginTop: spacing.md }}>{heroLine}</Text>
        {phase === 'trial' ? (
          <View style={{ marginTop: spacing.sm }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
              <View style={{ width: `${p.trial_days ? Math.round((trialUsed / p.trial_days) * 100) : 0}%`, height: 8, borderRadius: 4, backgroundColor: '#F2C14E' }} />
            </View>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 6 }}>{t('subscription.trial_progress', { used: n(trialUsed), total: n(p.trial_days) })}</Text>
            {state.trial_ends_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{t('subscription.trial_ends', { date: day(state.trial_ends_at) })}</Text> : null}
          </View>
        ) : null}
        {phase === 'exempt' && state.exempt_reason === 'founding' ? <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: 'rgba(255,255,255,0.86)', marginTop: 4 }}>{t('subscription.exempt_founding')}</Text> : null}
        {phase === 'pending' ? <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.86)', marginTop: 4 }}>{t('subscription.days_to_late', { count: state.days_left ?? 0 })}</Text> : null}
        {phase === 'late' ? <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: '#FFD0D6', marginTop: 4 }}>{t('subscription.days_to_block', { count: state.days_left ?? 0 })}</Text> : null}
      </LinearGradient>

      {/* Her stamped sheet: the receipt, the exemption or the bill */}
      {sheet ? <SubscriptionSheetView sheet={sheet} /> : null}

      {/* What it includes */}
      <View style={card}>
        <Text style={h}>{t('subscription.features_title')}</Text>
        <Text style={{ ...body, marginTop: 2 }}>{t('subscription.features_sub')}</Text>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          {features.map((f) => (
            <View key={f.key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: f.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={f.icon} size={20} color={f.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t(`subscription.feat_${f.key}_t`, { rose: rose.name })}</Text>
                <Text style={{ ...body, fontSize: 13.5, lineHeight: 21 }}>{t(`subscription.feat_${f.key}_b`)}</Text>
              </View>
              <Icon name="success" size={18} color={colors.success} />
            </View>
          ))}
        </View>
      </View>

      {/* The two plans */}
      <View style={card}>
        <Text style={h}>{t('subscription.plans_title')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <PlanTile title={t('subscription.plan_term')} length={t('subscription.plan_term_len')} price={egp(termPrice)}
            current={(hasBill || phase === 'active') && state.plan !== 'annual'} currentLabel={t('subscription.plan_current')}
            onPress={canChoose ? () => plan.mutate('term') : undefined} busy={plan.isPending} />
          <PlanTile title={t('subscription.plan_year')} length={t('subscription.plan_year_len')} price={egp(yearPrice)}
            save={t('subscription.save_vs_terms', { amount: n(termPrice * 3 - yearPrice) })}
            current={(hasBill || phase === 'active') && state.plan === 'annual'} currentLabel={t('subscription.plan_current')}
            onPress={canChoose ? () => plan.mutate('annual') : undefined} busy={plan.isPending} />
        </View>
        {late ? <Text style={{ ...body, fontSize: 12.5, color: colors.danger, marginTop: spacing.sm }}>{t('subscription.late_badge')}</Text> : null}
        {canChoose ? <Text style={{ ...body, fontSize: 12.5, marginTop: spacing.sm }}>{t('subscription.plan_tap_hint')}</Text> : null}
        {plan.isError ? <Text style={{ ...body, color: colors.danger }}>{getFriendlyErrorMessage(plan.error)}</Text> : null}
      </View>

      {/* How to pay, while a bill is open */}
      {hasBill && !isAssistant ? (
        <View style={card}>
          <Text style={h}>{t('subscription.pay_title')}</Text>
          {payment.instapay_number ? <PayLine label={t('subscription.pay_instapay')} value={`${payment.instapay_number}${payment.instapay_name ? ` — ${payment.instapay_name}` : ''}`} /> : null}
          {payment.vodafone_number ? <PayLine label={t('subscription.pay_vodafone')} value={payment.vodafone_number} /> : null}
          {payment.support_phone ? <PayLine label={t('subscription.pay_support')} value={payment.support_phone} /> : null}

          {sent ? (
            <View style={{ backgroundColor: colors.successLight, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md }}>
              <Text style={{ ...body, color: colors.successText, fontFamily: fonts.medium }}>{sent}</Text>
            </View>
          ) : (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Text style={{ ...body, fontFamily: fonts.medium, color: colors.textPrimary }}>{t('subscription.paid_method')}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                <Chip label={t('subscription.pay_instapay')} on={method === 'instapay'} onPress={() => setMethod('instapay')} />
                <Chip label={t('subscription.pay_vodafone')} on={method === 'vodafone_cash'} onPress={() => setMethod('vodafone_cash')} />
                <Chip label={t('subscription.pay_method_cash')} on={method === 'cash'} onPress={() => setMethod('cash')} />
                <Chip label={t('subscription.pay_method_other')} on={method === 'other'} onPress={() => setMethod('other')} />
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

      {/* The rules */}
      <View style={card}>
        <Text style={h}>{t('subscription.rules_title')}</Text>
        <View style={{ marginTop: spacing.sm, gap: 6 }}>
          <Rule text={t('subscription.rule_trial', { days: p.trial_days })} />
          <Rule text={t('subscription.rule_price', { term: n(p.term), year: n(p.year) })} />
          <Rule text={t('subscription.rule_grace', { days: p.grace_days })} />
          <Rule text={t('subscription.rule_late', { term: n(p.late_term), year: n(p.late_year) })} />
          <Rule text={t('subscription.rule_block', { days: p.block_days })} />
          <Rule text={t('subscription.rule_start')} />
        </View>
      </View>
    </View>
  );
}

function PlanTile({ title, length, price, save, current, currentLabel, onPress, busy }: {
  title: string; length: string; price: string; save?: string; current: boolean; currentLabel: string; onPress?: () => void; busy: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress || busy} activeOpacity={0.85} accessibilityRole={onPress ? 'button' : undefined} accessibilityState={{ selected: current }}
      style={{ flex: 1, borderRadius: radius.lg, borderWidth: 2, borderColor: current ? colors.primary : colors.border, backgroundColor: current ? colors.brandTint : colors.surface, padding: spacing.md, minHeight: 112 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: current ? colors.primary : colors.textPrimary }} numberOfLines={1}>{title}</Text>
        {current ? <Icon name="success" size={16} color={colors.primary} /> : null}
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }} numberOfLines={1}>{current ? currentLabel : length}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, marginTop: spacing.sm }} numberOfLines={1} adjustsFontSizeToFit>{price}</Text>
      {save ? <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.success, marginTop: 2 }}>{save}</Text> : null}
    </TouchableOpacity>
  );
}

function PayLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{label}</Text>
      <Text selectable style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{value}</Text>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: on ? colors.primary : colors.surfaceSunken, minHeight: 36, justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: on ? colors.textInverse : colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** A rule: the bullet at the start of the line (the right, in Arabic), the text after it. */
function Rule({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 8 }} />
      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, lineHeight: 21 }}>{text}</Text>
    </View>
  );
}
