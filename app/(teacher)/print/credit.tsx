import { useState } from 'react';
import { View, Text, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SheetModal } from '@/components/ui/SheetModal';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients, isDark, nav } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Banner } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatNumber, formatShortDate } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import { useAuthStore } from '@/stores/authStore';
import { OrderSection } from '@/components/print/OrderSection';
import { CreditRing, creditTint, egpAmount, daysText, jobsText, graceText } from '@/components/print/CreditBits';
import { getPrintCredit, disputePrintStrike, creditUsed, type PrintCredit } from '@/api/print';

// The hero is deep ink in BOTH schemes (founder: no washed tops), so what sits on it is white.
const ON = '#FFFFFF';
const ON_SOFT = 'rgba(255,255,255,0.74)';
const GLASS = 'rgba(255,255,255,0.10)';
const GLASS_BORDER = 'rgba(255,255,255,0.16)';

/** What the tier means for the next send, in one line. */
function meaningKey(c: PrintCredit): string {
  if (c.tier === 'frozen') return 'print.credit_meaning_frozen';
  if (c.tier === 'weak') return 'print.credit_meaning_weak';
  if (c.tier === 'new') return 'print.credit_meaning_new';
  return 'print.credit_meaning_ok';
}

/** A label and its value on one line of a card. */
function Row({ icon, label, value, tone, last }: { icon: IconName; label: string; value: string; tone?: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.borderLight }}>
      <Icon name={icon} size={16} color={tone ?? colors.textTertiary} />
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: tone ?? colors.textPrimary }}>{value}</Text>
    </View>
  );
}

/**
 * «سجل الدفع» — the teacher's payment record on the print market (founder 2026-10-15: «a credit
 * system … that shows vendors how good the teacher is at paying»). An ink hero with the score
 * ring, the tier and what it means; then «الآجل» (what may be owed at once, what is owed, the
 * next due, anything overdue with a way to pay it); the five parts the score is made of; the
 * standing strikes; what would raise it; the ladder of tiers and their lines; and exactly
 * what a shop sees — the tier, the score and plain counts, never an amount. Teacher only.
 */
export default function PrintCreditScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const isAssistant = useAuthStore((st) => st.role === 'assistant');
  const credit = useQuery({ queryKey: ['print-credit'], queryFn: getPrintCredit, enabled: !isAssistant });
  // Disputing a strike: once per strike, a line of what happened; the admin answers in a notification.
  const qc = useQueryClient();
  const [disputing, setDisputing] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const dispute = useMutation({
    mutationFn: ({ id, n }: { id: number; n: string }) => disputePrintStrike(id, n),
    onSuccess: (fresh) => { qc.setQueryData(['print-credit'], fresh); setDisputing(null); setNote(''); },
  });
  const { refreshing, onRefresh } = usePullRefresh(credit.refetch);
  const c = credit.data;
  const egp = t('teacher.egp');

  // Ink by day; by night the navy, lifted to indigo at the foot so the rounded edge shows.
  const heroFill: readonly [string, string, ...string[]] = isDark() ? [gradients.hero[0], gradients.hero[1], colors.primaryLight] : gradients.auth;
  const tint = c ? creditTint(c.tone) : creditTint('info');
  const m = c?.money;
  const used = m ? creditUsed(m) : 0;
  const overdue = !!m && m.overdue_count > 0;
  const barColor = overdue ? colors.danger : used > 0.8 ? colors.warning : colors.brand;
  const goPay = () => router.push('/(teacher)/print' as Href);

  return (
    <Surface id="screen.teacher.print_credit" screen assistantNeeds="teacher">
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {focused ? <StatusBar style="light" /> : null}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.pageEnd + insets.bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {/* hero */}
        <LinearGradient colors={heroFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderBottomStartRadius: 28, borderBottomEndRadius: 28, overflow: 'hidden' }}>
          <View pointerEvents="none" style={{ position: 'absolute', top: -90, start: -70, width: 240, height: 240, borderRadius: 120, backgroundColor: colors.accent, opacity: 0.14 }} />
          <View pointerEvents="none" style={{ position: 'absolute', bottom: -80, end: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: ON, opacity: 0.05 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}
              style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_BORDER, justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="forward" size={20} color={ON} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 30, color: ON }} numberOfLines={1}>{t('print.credit_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: ON_SOFT }} numberOfLines={2}>{t('print.credit_sub')}</Text>
            </View>
          </View>

          {c ? (
            <View style={{ alignItems: 'center', marginTop: spacing.lg }} accessible accessibilityLabel={t('print.credit_score_a11y', { score: formatNumber(c.score), tier: c.tier_label })}>
              <CreditRing score={c.score} tone={c.tone} size={148} stroke={13} onInk caption={t('print.credit_of_max', { n: formatNumber(100) })} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, paddingHorizontal: 14, height: 32, borderRadius: radius.full, backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_BORDER }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: tint.solid }} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: ON }}>{c.tier_label}</Text>
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: ON_SOFT, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.lg }}>{t(meaningKey(c))}</Text>
            </View>
          ) : (
            <View style={{ height: 220, alignItems: 'center', justifyContent: 'center' }}>
              {credit.isLoading ? <ActivityIndicator color={ON} /> : null}
            </View>
          )}
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          {credit.isError && !c ? <Banner tone="danger" text={t('print.failed')} /> : null}

          {c && m ? (
            <>
              {!c.on ? <Banner tone="info" text={t('print.credit_off')} /> : null}

              {/* overdue — the one thing to do now */}
              {overdue ? (
                <View style={{ backgroundColor: colors.dangerLight, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.danger, padding: spacing.lg, marginBottom: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="warning" size={19} color={colors.onPrimary} />
                    </View>
                    <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.dangerText }}>{t('print.credit_overdue_title')}</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 22, color: colors.dangerText, marginTop: spacing.sm }}>
                    {t('print.credit_overdue_line', { amount: egpAmount(m.overdue), egp, jobs: jobsText(t, m.overdue_count) })}
                  </Text>
                  {m.oldest_overdue_days >= 1 ? (
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.dangerText, opacity: 0.85 }}>{t('print.credit_overdue_oldest', { days: daysText(t, m.oldest_overdue_days) })}</Text>
                  ) : null}
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.dangerText, opacity: 0.85, marginTop: 4 }}>{t('print.credit_overdue_note')}</Text>
                  <Button title={t('print.credit_pay_now')} variant="destructive" onPress={goPay} style={{ marginTop: spacing.md }} />
                </View>
              ) : null}

              {/* «الآجل» */}
              <OrderSection icon="money" title={t('print.credit_line_title')} hint={t('print.credit_line_hint')} tint={{ bg: colors.brandTint, fg: colors.brand }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{t('print.credit_available')}</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 28, lineHeight: 40, color: overdue ? colors.dangerText : colors.textPrimary }}>
                      {egpAmount(m.available)} <Text style={{ fontSize: 14, color: colors.textSecondary }}>{egp}</Text>
                    </Text>
                  </View>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>{t('print.credit_of_limit', { limit: egpAmount(m.limit), egp })}</Text>
                </View>
                {/* the used part of the line */}
                <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.surfaceSunken, overflow: 'hidden', marginTop: 4 }}>
                  <View style={{ width: `${Math.round(used * 100)}%`, height: '100%', borderRadius: 5, backgroundColor: barColor }} />
                </View>
                <View style={{ marginTop: spacing.sm }}>
                  <Row icon="invoices" label={t('print.credit_owed')} value={`${egpAmount(m.owed)} ${egp}`} tone={overdue ? colors.dangerText : undefined} />
                  <Row icon="calendar" label={t('print.credit_next_due')}
                    value={m.next_due_at && m.next_due_total != null ? t('print.credit_next_due_line', { amount: egpAmount(m.next_due_total), egp, at: formatShortDate(m.next_due_at) }) : t('print.credit_nothing_due')} />
                  {m.prepay_waiting > 0 ? (
                    <Row icon="clock" label={t('print.credit_prepay_waiting')} tone={colors.warningText}
                      value={t('print.credit_prepay_waiting_line', { jobs: jobsText(t, m.prepay_waiting), amount: egpAmount(m.prepay_waiting_total), egp })} />
                  ) : null}
                  <Row icon="success" label={t('print.credit_paid_total')} value={`${egpAmount(m.paid_total)} ${egp}`} last />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSunken }}>
                  <Icon name="clock" size={14} color={colors.textSecondary} />
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{t('print.credit_on_credit', { grace: graceText(t, m.grace_days) })}</Text>
                </View>
              </OrderSection>

              {/* the five parts */}
              <OrderSection icon="reports" title={t('print.credit_parts_title')} hint={t('print.credit_parts_hint')} tint={tint}>
                {c.parts.map((p, i) => {
                  const r = p.max > 0 ? Math.max(0, Math.min(1, p.points / p.max)) : 0;
                  const fill = r >= 0.8 ? colors.success : r >= 0.5 ? colors.brand : colors.warning;
                  return (
                    <View key={p.key} style={{ marginTop: i ? spacing.md : 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{p.label}</Text>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{t('print.credit_points', { p: formatNumber(p.points), max: formatNumber(p.max) })}</Text>
                      </View>
                      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceSunken, overflow: 'hidden' }}>
                        <View style={{ width: `${Math.round(r * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: fill }} />
                      </View>
                      {p.hint ? <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 17, color: colors.textTertiary, marginTop: 4 }}>{p.hint}</Text> : null}
                    </View>
                  );
                })}
              </OrderSection>

              {/* standing strikes */}
              {c.strikes.length ? (
                <OrderSection icon="warning" title={t('print.credit_strikes_title')} hint={t('print.credit_strikes_hint')} tint={{ bg: colors.dangerLight, fg: colors.dangerText }}>
                  {c.strikes.map((s, i) => (
                    <View key={`${s.at}-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 9, borderBottomWidth: i === c.strikes.length - 1 ? 0 : 1, borderBottomColor: colors.borderLight }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.textPrimary }}>{s.label}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>{formatShortDate(s.at)}</Text>
                        {s.dispute_open ? (
                          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.warningText }}>{t('print.credit_dispute_pending')}</Text>
                        ) : s.dispute_answer ? (
                          <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>{t('print.credit_dispute_answer', { a: s.dispute_answer })}</Text>
                        ) : s.can_dispute && s.id ? (
                          <TouchableOpacity onPress={() => setDisputing(s.id!)} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 12, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Icon name="ticket" size={13} color={colors.brand} />
                            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('print.credit_dispute')}</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <View style={{ paddingHorizontal: 9, height: 24, borderRadius: 12, backgroundColor: colors.dangerLight, justifyContent: 'center' }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.dangerText }}>{t('print.credit_strike_points', { p: formatNumber(s.points) })}</Text>
                      </View>
                    </View>
                  ))}
                </OrderSection>
              ) : null}

              {/* what would raise it */}
              {c.tips.length ? (
                <OrderSection icon="up" title={t('print.credit_tips_title')} tint={{ bg: colors.accentLight, fg: colors.accentText }}>
                  {c.tips.map((tip, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: i ? spacing.sm : 0 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, lineHeight: 16, color: colors.accentText }}>{formatNumber(i + 1)}</Text>
                      </View>
                      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.textPrimary }}>{tip}</Text>
                    </View>
                  ))}
                </OrderSection>
              ) : null}

              {/* the ladder, top tier first */}
              <OrderSection icon="ribbon" title={t('print.credit_ladder_title')} hint={t('print.credit_ladder_hint')} tint={{ bg: colors.brandTint, fg: colors.brand }}>
                {[...c.ladder].reverse().map((l, i) => {
                  const here = l.tier === c.tier;
                  const lt = creditTint(l.tier === 'fair' ? 'warn' : 'ok');
                  return (
                    <View key={l.tier} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: i ? spacing.sm : 0, borderRadius: radius.lg,
                      backgroundColor: here ? colors.brandTint : colors.surfaceSunken, borderWidth: here ? 1.5 : 1, borderColor: here ? colors.brand : colors.borderLight }}>
                      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: lt.bg, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: lt.fg }}>{formatNumber(l.from)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{l.label}</Text>
                          {here ? (
                            <View style={{ paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: colors.brand, justifyContent: 'center' }}>
                              <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: colors.onPrimary }}>{t('print.credit_ladder_you')}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('print.credit_ladder_from', { n: formatNumber(l.from) })}</Text>
                      </View>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }}>{t('print.credit_ladder_limit', { limit: egpAmount(l.limit), egp })}</Text>
                    </View>
                  );
                })}
              </OrderSection>

              {/* exactly what a shop sees */}
              <OrderSection icon="storefront" title={t('print.credit_shop_title')} hint={t('print.credit_shop_hint')} tint={{ bg: colors.surfaceSunken, fg: colors.textSecondary }}>
                <ShopSees c={c} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.md }}>
                  <Icon name="lock" size={14} color={colors.textTertiary} />
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textTertiary }}>{t('print.credit_privacy')}</Text>
                </View>
              </OrderSection>
            </>
          ) : null}
        </View>
      </ScrollView>
      <SheetModal visible={disputing !== null} onClose={() => { setDisputing(null); dispute.reset(); }} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.xxl, paddingBottom: spacing.xl5 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('print.credit_dispute_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: spacing.xs }}>{t('print.credit_dispute_hint')}</Text>
        <TextInput value={note} onChangeText={setNote} placeholder={t('print.credit_dispute_ph')} placeholderTextColor={colors.textTertiary} multiline maxLength={500}
          style={{ fontFamily: fonts.regular, fontSize: 15, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md, marginBottom: spacing.md, color: colors.textPrimary, textAlign: 'right', minHeight: 96, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border }} />
        {dispute.isError ? <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.dangerText, marginBottom: spacing.sm }}>{getFriendlyErrorMessage(dispute.error)}</Text> : null}
        <Button title={t('print.credit_dispute_send')} loading={dispute.isPending} disabled={note.trim().length < 5}
          onPress={() => { if (disputing !== null && note.trim().length >= 5) dispute.mutate({ id: disputing, n: note.trim() }); }} />
      </SheetModal>
    </View>
    </Surface>
  );
}

/** The shop's view of this teacher, drawn as the shop's queue draws it: tier, score, counts. */
function ShopSees({ c }: { c: PrintCredit }) {
  const { t } = useTranslation();
  const s = c.shop_sees;
  const tint = creditTint(s.tone);
  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: tint.bg, borderWidth: 2, borderColor: tint.solid, alignItems: 'center', justifyContent: 'center' }}>
          {s.score != null ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 24, color: tint.fg }}>{formatNumber(s.score)}</Text>
          ) : (
            <Icon name="child" size={20} color={tint.fg} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary }}>{t('print.credit_shop_card_label')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: tint.bg, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: tint.fg }}>{s.tier_label}</Text>
            </View>
            {s.score == null ? <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>{t('print.credit_shop_no_score')}</Text> : null}
          </View>
        </View>
      </View>
      <View style={{ marginTop: spacing.sm }}>
        {s.lines.map((l, i) => {
          const fg = l.ok === true ? colors.success : l.ok === false ? colors.danger : colors.textTertiary;
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 }}>
              <Icon name={l.ok === true ? 'success' : l.ok === false ? 'absent' : 'info'} size={16} color={fg} />
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.textPrimary }}>{l.text}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
