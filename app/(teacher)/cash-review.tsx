import { memo, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { formatDate, formatShortDate, formatNumber } from '@/utils/format';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getFriendlyErrorMessage } from '@/utils/errors';
import {
  getWeeklyReview, decideExpense, bulkAccept, flagReview, closeWeek, addCorrection,
  type Expense, type ReviewStatus, type WeeklyReview,
} from '@/api/cash';

/**
 * Weekly review — the teacher reconciles (spec 2026-09-25). The assistant submitted; here
 * the teacher accepts, QUESTIONS (held, the gap does not move) or rejects (with a reason —
 * the amount moves into the gap) each expense, sees what every decision does to the week
 * before confirming it, and closes the week. The drawer's own assistant opens the same
 * screen read-only, with their own items only (the server decides the shape).
 *
 * Nothing here decides automatically. Bulk accept only covers what was shown above it.
 */

const money = (v: number) => formatNumber(v, { maximumFractionDigits: 2 });
type Filter = 'all' | ReviewStatus | 'late';
const STATE_TINT: Record<ReviewStatus, string> = {
  pending: colors.textTertiary, accepted: colors.success, questioned: colors.warning, rejected: colors.danger,
};

/** What a decision would do to the difference (registry − expected), before the tap. */
function impactOf(e: Expense, action: 'accept' | 'question' | 'reject', difference: number | null): number | null {
  if (difference === null) return null;
  const counted = e.review_status !== 'rejected';
  if (action === 'reject') return counted ? difference - e.amount : difference;
  if (action === 'accept') return counted ? difference : difference + e.amount;
  return counted ? difference : difference + e.amount; // question: held — back out of the gap if it was rejected
}

const Line = memo(function Line({ label, value, strong, tint }: { label: string; value: string; strong?: boolean; tint?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ fontFamily: strong ? fonts.bold : fonts.regular, fontSize: 14, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: strong ? 17 : 15, color: tint ?? colors.textPrimary }}>{value}</Text>
    </View>
  );
});

function ItemCard({ e, review, isTeacher, onDecided }: { e: Expense; review: WeeklyReview; isTeacher: boolean; onDecided: (before: number | null, after: number | null) => void }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const [panel, setPanel] = useState<null | 'question' | 'reject'>(null);
  const [text, setText] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const difference = review.reconciliation.difference;
  const locked = review.closed || e.locked;

  const decide = useMutation({
    mutationFn: (p: Parameters<typeof decideExpense>[1]) => decideExpense(e.id, p),
    onSuccess: (r) => { setPanel(null); setText(''); setReason(null); onDecided(r.before, r.after); },
    onError: (err) => Alert.alert(t('common.error'), getFriendlyErrorMessage(err)),
  });

  const impact = (action: 'accept' | 'question' | 'reject') => {
    const after = impactOf(e, action, difference);
    if (difference === null || after === null || after === difference) return t('review.impact_none');
    return t('review.impact', { before: money(difference), after: money(after) });
  };

  const tint = STATE_TINT[e.review_status];
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: e.review_status === 'pending' ? colors.border : tint, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{money(e.amount)} {egp}</Text>
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>· {e.category_label}</Text>
        <View style={{ backgroundColor: tint + '22', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: tint }}>{t(`review.state_${e.review_status}`)}</Text>
        </View>
      </View>
      {e.note ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>{e.note}</Text> : null}
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>
        {formatShortDate(e.expense_date)}{e.venue?.name ? ` · ${e.venue.name}` : ''}
      </Text>
      {e.is_late ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark, marginTop: 2 }}>{t('review.late', { date: formatDate(e.expense_date, { day: 'numeric', month: 'long' }) })}</Text> : null}
      {e.adjusts_week ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark, marginTop: 2 }}>{t('review.adjusts', { date: formatShortDate(e.adjusts_week) })}</Text> : null}
      {e.review_status === 'rejected' && e.reject_reason_label ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.danger, marginTop: 2 }}>{e.reject_reason_label}{e.reject_note ? ` — ${e.reject_note}` : ''}</Text>
      ) : null}
      {e.messages_count > 0 ? (
        <TouchableOpacity onPress={() => router.push({ pathname: '/(teacher)/expense-thread', params: { id: String(e.id) } } as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
          <Icon name="tickets" size={14} color={colors.brand} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('review.thread', { count: e.messages_count })}{e.has_receipt ? ` · ${t('review.receipt')}` : ''}</Text>
        </TouchableOpacity>
      ) : null}

      {isTeacher && !locked ? (
        panel === null ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            {e.review_status !== 'accepted' ? (
              <TouchableOpacity onPress={() => decide.mutate({ action: 'accept' })} disabled={decide.isPending} style={{ flex: 1, height: 38, borderRadius: radius.md, backgroundColor: colors.success + '18', borderWidth: 1, borderColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.successDark }}>{t('review.accept')}</Text>
              </TouchableOpacity>
            ) : null}
            {e.review_status !== 'questioned' ? (
              <TouchableOpacity onPress={() => setPanel('question')} style={{ flex: 1, height: 38, borderRadius: radius.md, backgroundColor: colors.warning + '18', borderWidth: 1, borderColor: colors.warning, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.warningDark }}>{t('review.question')}</Text>
              </TouchableOpacity>
            ) : null}
            {e.review_status !== 'rejected' ? (
              <TouchableOpacity onPress={() => setPanel('reject')} style={{ flex: 1, height: 38, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.danger }}>{t('review.reject')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={{ marginTop: spacing.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{panel === 'question' ? t('review.question_title') : t('review.reject_title')}</Text>
            {panel === 'reject' ? (
              <>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('review.reject_hint')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm }}>
                  {(review.reasons ?? []).map((r) => {
                    const on = reason === r.key;
                    return (
                      <TouchableOpacity key={r.key} onPress={() => setReason(r.key)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: on ? colors.danger : colors.border, backgroundColor: on ? colors.danger + '14' : colors.surface }}>
                        <Text style={{ fontFamily: on ? fonts.bold : fonts.regular, fontSize: 13, color: on ? colors.danger : colors.textPrimary }}>{r.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}
            <TextInput value={text} onChangeText={setText} multiline maxLength={500}
              placeholder={panel === 'question' ? t('review.question_placeholder') : t('review.reject_note')} placeholderTextColor={colors.textTertiary}
              style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'right', minHeight: 56, marginTop: spacing.sm, backgroundColor: colors.surface }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: panel === 'reject' ? colors.danger : colors.textSecondary, marginTop: spacing.sm }}>{impact(panel)}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={panel === 'question' ? t('review.send_question') : t('review.confirm_reject')}
                  variant={panel === 'reject' ? 'destructive' : 'primary'}
                  loading={decide.isPending}
                  disabled={panel === 'question' ? text.trim() === '' : !reason || (reason === 'other' && text.trim() === '')}
                  onPress={() => decide.mutate(panel === 'question' ? { action: 'question', note: text.trim() } : { action: 'reject', reason: reason as string, note: text.trim() || undefined })}
                />
              </View>
              <View style={{ flex: 1 }}><Button title={t('common.cancel')} variant="outline" onPress={() => setPanel(null)} /></View>
            </View>
          </View>
        )
      ) : null}
    </View>
  );
}

export default function CashReviewScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const rid = Number(id);
  const { data, isLoading, refetch } = useQuery({ queryKey: ['cash-review', rid], queryFn: () => getWeeklyReview(rid), enabled: rid > 0 });
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const [filter, setFilter] = useState<Filter>('all');
  const [countFlag, setCountFlag] = useState('');
  const [collectionFlag, setCollectionFlag] = useState('');
  const [corrAmount, setCorrAmount] = useState('');
  const [corrNote, setCorrNote] = useState('');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cash-review', rid] });
    qc.invalidateQueries({ queryKey: ['cash-reconciliation'] });
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['cash-insights'] });
  };
  const onError = (e: unknown) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e));

  const isTeacher = data?.blocking !== undefined;
  const r = data?.reconciliation;
  const items = useMemo(() => {
    const all = data?.items ?? [];
    if (filter === 'all') return all;
    if (filter === 'late') return all.filter((e) => e.is_late || e.adjusts_week);
    return all.filter((e) => e.review_status === filter);
  }, [data, filter]);
  const shownPending = useMemo(() => items.filter((e) => e.review_status === 'pending').map((e) => e.id), [items]);

  const bulk = useMutation({
    mutationFn: () => bulkAccept(rid, shownPending),
    onSuccess: (res) => { invalidate(); Alert.alert(t('review.bulk_done', { count: res.accepted }), res.excluded_large ? t('review.bulk_excluded', { count: res.excluded_large }) : undefined); },
    onError,
  });
  const flag = useMutation({ mutationFn: (p: Parameters<typeof flagReview>[1]) => flagReview(rid, p), onSuccess: () => { setCountFlag(''); setCollectionFlag(''); invalidate(); }, onError });
  const close = useMutation({ mutationFn: () => closeWeek(rid), onSuccess: () => { invalidate(); Alert.alert(t('review.closed')); }, onError });
  const correct = useMutation({ mutationFn: () => addCorrection(rid, Number(corrAmount), corrNote.trim()), onSuccess: () => { setCorrAmount(''); setCorrNote(''); invalidate(); Alert.alert(t('review.correction_saved')); }, onError });

  const confirmClose = () => {
    if (!r) return;
    const result = r.result && r.difference !== null ? `${t(`cash.${r.result}`)} ${money(r.difference)}` : '';
    Alert.alert(t('review.close_confirm_title'), t('review.close_confirm_hint', { expected: money(r.expected ?? 0), actual: money(r.actual ?? 0), result }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('review.close'), onPress: () => close.mutate() },
    ]);
  };

  const egp = t('insights.egp');
  const resultTint = r?.result === 'deficit' ? colors.danger : r?.result === 'surplus' ? colors.warningDark : colors.success;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('review.title')}</Text>
          {r ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('review.week_of', { start: formatShortDate(r.week_start), end: formatShortDate(r.week_end), name: r.name })}{r.venue?.name ? ` · ${r.venue.name}` : ''}</Text> : null}
        </View>
      </View>

      {isLoading || !data || !r ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* §6 — every line of the week, then what the review did to it. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}>
            {r.opening_balance !== null ? <Line label={t('cash.opening')} value={`${money(r.opening_balance)} ${egp}`} /> : null}
            <Line label={t('cash.collected_teacher')} value={`${money(r.collected)} ${egp}`} />
            <Line label={t('review.presented')} value={`${money(r.presented_expenses ?? r.expenses)} ${egp}`} />
            {(r.held ?? 0) > 0 ? <Line label={`  ${t('review.held')}`} value={`${money(r.held ?? 0)} ${egp}`} tint={colors.warningDark} /> : null}
            {(r.rejected_expenses ?? 0) > 0 ? <Line label={`  ${t('review.rejected')}`} value={`${money(r.rejected_expenses ?? 0)} ${egp}`} tint={colors.danger} /> : null}
            {r.handovers > 0 ? <Line label={t('cash.handovers')} value={`${money(r.handovers)} ${egp}`} /> : null}
            <Line label={t('cash.expected')} value={r.expected !== null ? `${money(r.expected)} ${egp}` : t('cash.cannot_compute')} strong tint={colors.brand} />
            <Line label={t('cash.actual')} value={r.actual !== null && r.actual !== undefined ? `${money(r.actual)} ${egp}` : '—'} strong />
            {r.teacher_count !== null && r.teacher_count !== undefined ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('review.flag_count_label', { amount: money(r.teacher_count), assistant: money(r.registry ?? 0) })}</Text>
            ) : null}
            {r.difference !== null && r.result ? (
              <Line label={t(`cash.${r.result}`)} value={`${r.difference > 0 ? '+' : ''}${money(r.difference)} ${egp}`} strong tint={resultTint} />
            ) : null}
            {(r.rejected_expenses ?? 0) > 0 && r.difference_before_review !== null && r.difference_before_review !== undefined && r.difference !== null ? (
              <View style={{ marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                <Line label={t('review.before_review', { label: t('cash.gap') })} value={`${money(r.difference_before_review)} ${egp}`} />
                <Line label={t('review.rejected')} value={`${money(r.rejected_expenses ?? 0)} ${egp}`} tint={colors.danger} />
                <Line label={t('review.after_review', { label: t('cash.gap') })} value={`${money(r.difference)} ${egp}`} strong tint={resultTint} />
              </View>
            ) : null}
          </View>

          {data.closed ? (
            <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('review.closed')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('review.closed_hint')}</Text>
            </View>
          ) : null}
          {!isTeacher ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md }}>{t('review.readonly_hint')}</Text> : null}
          {isTeacher && data.counts.pending + data.counts.questioned > 0 ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.warningDark, marginBottom: spacing.sm }}>{t('review.waiting', { count: formatNumber(data.counts.pending + data.counts.questioned) })}</Text>
          ) : null}

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }} style={{ flexGrow: 0 }}>
            {(['all', 'pending', 'questioned', 'rejected', 'accepted', 'late'] as Filter[]).map((f) => {
              const on = filter === f;
              const label = f === 'all' ? t('expenses.filter_all') : f === 'late' ? t('expenses.late') : t(`review.state_${f}`);
              return (
                <TouchableOpacity key={f} onPress={() => setFilter(f)} style={{ flexShrink: 0, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brand + '18' : colors.surface }}>
                  <Text style={{ fontFamily: on ? fonts.bold : fonts.regular, fontSize: 12, color: on ? colors.brand : colors.textSecondary }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {items.length === 0 ? (
            <EmptyState icon="success" title={t('review.none')} />
          ) : (
            items.map((e) => <ItemCard key={e.id} e={e} review={data} isTeacher={isTeacher} onDecided={invalidate} />)
          )}

          {/* §8 — below the list on purpose: it only exists after the list has been seen. */}
          {isTeacher && !data.closed && shownPending.length > 0 ? (
            <View style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
              <Button title={t('review.bulk')} variant="success" onPress={() => bulk.mutate()} loading={bulk.isPending} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 4, textAlign: 'center' }}>{t('review.bulk_hint', { amount: money(data.bulk_max ?? 500) })}</Text>
            </View>
          ) : null}

          {isTeacher && !data.closed ? (
            <>
              {/* §9 — flags beyond expenses. */}
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('review.flags_title')}</Text>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('review.flag_count')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{t('review.flag_count_hint')}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  <TextInput value={countFlag} onChangeText={(v) => setCountFlag(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, textAlign: 'right' }} />
                  <Button title={t('review.flag_save')} onPress={() => flag.mutate({ kind: 'count', amount: Number(countFlag) })} disabled={countFlag === ''} loading={flag.isPending} />
                </View>
              </View>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('review.flag_collection')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{t('review.flag_collection_hint')}</Text>
                <TextInput value={collectionFlag} onChangeText={setCollectionFlag} maxLength={500} placeholderTextColor={colors.textTertiary}
                  style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, textAlign: 'right', marginBottom: spacing.sm }} />
                <Button title={t('review.flag_save')} onPress={() => flag.mutate({ kind: 'collection', note: collectionFlag.trim() })} disabled={collectionFlag.trim() === ''} loading={flag.isPending} />
              </View>
              {/* The real fix for a missing collection is to record it — a quiet dashed row, same shape as the handover button on the hub. */}
              <TouchableOpacity onPress={() => router.push('/(teacher)/pending-collections' as Href)} activeOpacity={0.85}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, borderStyle: 'dashed', marginBottom: spacing.sm }}>
                <Icon name="money" size={18} color={colors.brand} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('cash.surplus_record')}</Text>
                <Icon name="back" size={16} color={colors.brand} />
              </TouchableOpacity>
              {(data.flags ?? []).map((f) => (
                <Text key={f.id} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: 2 }}>
                  • {f.kind === 'count' ? t('review.flag_count') : t('review.flag_collection')}{f.amount !== null ? ` ${money(f.amount)} ${egp}` : ''}{f.note ? ` — ${f.note}` : ''}
                </Text>
              ))}

              {/* §10 — closing. A remaining gap never blocks it; undecided items do. */}
              <View style={{ marginTop: spacing.lg }}>
                {(data.blocking ?? []).map((b) => (
                  <Text key={b} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark, marginBottom: 2 }}>• {t(`review.block_${b}`)}</Text>
                ))}
                <Button title={t('review.close')} onPress={confirmClose} disabled={!data.can_close} loading={close.isPending} style={{ marginTop: spacing.sm }} />
              </View>
            </>
          ) : null}

          {/* §11 — after closing, corrections are adjustments in the current week. */}
          {isTeacher && data.closed ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('review.corrections_title')}</Text>
              {(data.corrections ?? []).map((c) => (
                <Text key={c.id} style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>
                  • {c.amount > 0 ? '+' : ''}{money(c.amount)} {egp} — {c.note} ({formatShortDate(c.booked_week_start)})
                </Text>
              ))}
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm }}>
                <TextInput value={corrAmount} onChangeText={(v) => setCorrAmount(v.replace(/[^0-9.\-]/g, ''))} keyboardType="numbers-and-punctuation" placeholder={t('review.correction_amount')} placeholderTextColor={colors.textTertiary}
                  style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, textAlign: 'right', marginBottom: spacing.sm }} />
                <TextInput value={corrNote} onChangeText={setCorrNote} placeholder={t('review.correction_note')} placeholderTextColor={colors.textTertiary} maxLength={500}
                  style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, textAlign: 'right', marginBottom: spacing.sm }} />
                <Button title={t('review.correction_add')} onPress={() => correct.mutate()} disabled={!Number(corrAmount) || corrNote.trim() === ''} loading={correct.isPending} />
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
