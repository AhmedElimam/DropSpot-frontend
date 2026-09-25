import { memo, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { formatShortDate, formatDateTime, formatNumber } from '@/utils/format';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getFriendlyErrorMessage } from '@/utils/errors';
import {
  getCashReconciliation, respondReconciliation, resolveReconciliation,
  type AssistantCashView, type TeacherCashView, type MyReconciliation, type AssistantLine, type ReconciliationStatus,
} from '@/api/cash';

/**
 * Weekly cash reconciliation (spec 2026-09-25 §5, §9). One screen, two shapes decided by
 * the SERVER's `role`:
 *
 *  · assistant — «حصّلت هذا الأسبوع X. هل هذا المبلغ في الخزنة؟» with two answers. "No"
 *    asks what IS in the box and why; the unexplained gap is computed server-side as
 *    collected − expenses − registry. Their own figures only — never the teacher's.
 *  · teacher — the week's totals, expenses split, one line per assistant with status and
 *    gap, open gaps from earlier weeks, and the per-assistant running total (§13).
 */

const money = (v: number) => formatNumber(v, { maximumFractionDigits: 2 });

const STATUS_TINT: Record<ReconciliationStatus, string> = {
  confirmed: colors.success, discrepancy: colors.danger, pending: colors.warning, not_reconciled: colors.warning,
};

const Figure = memo(function Figure({ label, value, strong, tint }: { label: string; value: string; strong?: boolean; tint?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ fontFamily: strong ? fonts.bold : fonts.regular, fontSize: 14, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: strong ? 18 : 15, color: tint ?? colors.textPrimary }}>{value}</Text>
    </View>
  );
});

const StatusPill = memo(function StatusPill({ status }: { status: ReconciliationStatus }) {
  const { t } = useTranslation();
  const tint = STATUS_TINT[status];
  return (
    <View style={{ backgroundColor: tint + '22', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: tint }}>{t(`cash.${status}`)}</Text>
    </View>
  );
});

/** The assistant's prompt card for ONE week — the two-button question, then the difference form. */
function PromptCard({ row, onDone }: { row: MyReconciliation; onDone: (status: ReconciliationStatus) => void }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const [mode, setMode] = useState<'ask' | 'diff'>('ask');
  const [registry, setRegistry] = useState('');
  const [reason, setReason] = useState('');

  const registryNum = Number(registry);
  const gap = Number.isFinite(registryNum) && registry !== '' ? Math.round((row.collected - row.expenses - registryNum) * 100) / 100 : null;
  const needsReason = gap !== null && gap !== 0 && reason.trim() === '';

  const respond = useMutation({
    mutationFn: (payload: { full: true } | { full: false; registry: number; reason?: string }) => respondReconciliation(row.id, payload),
    onSuccess: (r) => onDone(r.status),
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.warning, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Icon name="money" size={20} color={colors.warning} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('cash.week_of', { start: formatShortDate(row.week_start), end: formatShortDate(row.week_end) })}</Text>
      </View>
      <Figure label={t('cash.collected')} value={`${money(row.collected)} ${egp}`} strong />
      {row.expenses > 0 ? <Figure label={t('cash.my_expenses')} value={`− ${money(row.expenses)} ${egp}`} /> : null}
      <Figure label={t('cash.expected')} value={`${money(row.expected_in_registry)} ${egp}`} strong tint={colors.brand} />

      {mode === 'ask' ? (
        <>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, textAlign: 'center', marginVertical: spacing.md }}>{t('cash.question')}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button title={t('cash.yes_full')} variant="success" onPress={() => respond.mutate({ full: true })} loading={respond.isPending} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('cash.no_diff')} variant="outline" onPress={() => setMode('diff')} disabled={respond.isPending} />
            </View>
          </View>
        </>
      ) : (
        <View style={{ marginTop: spacing.md }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{t('cash.registry')}</Text>
          <TextInput
            value={registry}
            onChangeText={(v) => setRegistry(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'right', marginBottom: spacing.sm }}
          />
          {gap !== null ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: gap === 0 ? colors.success : colors.danger, marginBottom: spacing.sm }}>
              {gap === 0 ? t('cash.no_gap_preview') : t('cash.gap_preview', { amount: money(gap) })}
            </Text>
          ) : null}
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{t('cash.reason')}</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t('cash.reason_placeholder')}
            placeholderTextColor={colors.textTertiary}
            maxLength={500}
            multiline
            style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'right', minHeight: 64, marginBottom: spacing.sm }}
          />
          {needsReason ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.danger, marginBottom: spacing.sm }}>{t('cash.reason_required')}</Text> : null}
          <Button
            title={t('cash.submit')}
            onPress={() => respond.mutate({ full: false, registry: registryNum, reason: reason.trim() || undefined })}
            disabled={gap === null || needsReason}
            loading={respond.isPending}
          />
          <TouchableOpacity onPress={() => setMode('ask')} style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function AssistantView({ v, onDone }: { v: AssistantCashView; onDone: (s: ReconciliationStatus) => void }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const answered = v.reconciliation && !['pending', 'not_reconciled'].includes(v.reconciliation.status) ? v.reconciliation : null;

  return (
    <>
      {v.unanswered.map((row, i) => (
        <View key={row.id}>
          {i === 0 && row.week_start !== v.week.start ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark, marginBottom: spacing.sm }}>{t('cash.late_answer_hint')}</Text>
          ) : null}
          <PromptCard row={row} onDone={onDone} />
        </View>
      ))}

      {answered ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('cash.week_of', { start: formatShortDate(answered.week_start), end: formatShortDate(answered.week_end) })}</Text>
            <StatusPill status={answered.status} />
          </View>
          <Figure label={t('cash.collected')} value={`${money(answered.collected)} ${egp}`} />
          <Figure label={t('cash.my_expenses')} value={`${money(answered.expenses)} ${egp}`} />
          <Figure label={t('cash.registry')} value={`${money(answered.registry ?? 0)} ${egp}`} />
          {answered.gap !== null && answered.gap !== 0 ? <Figure label={t('cash.gap')} value={`${money(answered.gap)} ${egp}`} strong tint={colors.danger} /> : null}
          {answered.reason ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>{t('cash.reason_label', { reason: answered.reason })}</Text> : null}
          {answered.responded_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>{t('cash.answered_at', { when: formatDateTime(answered.responded_at) })}</Text> : null}
        </View>
      ) : null}

      {v.unanswered.length === 0 && !answered ? (
        <EmptyState icon="success" title={t('cash.no_prompt')} message={t('cash.no_prompt_hint')} />
      ) : null}

      {/* This week so far — their own figures, always visible. */}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginTop: spacing.md }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: 4 }}>{t('cash.week_of', { start: formatShortDate(v.week.start), end: formatShortDate(v.week.end) })}</Text>
        <Figure label={t('cash.collected')} value={`${money(v.collected)} ${egp}`} strong />
        <Figure label={t('cash.my_expenses')} value={`${money(v.expenses)} ${egp}`} />
        <Figure label={t('cash.expected')} value={`${money(v.expected_in_registry)} ${egp}`} strong tint={colors.brand} />
        <TouchableOpacity onPress={() => router.push('/(teacher)/expenses' as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
          <Icon name="note" size={16} color={colors.brand} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('expenses.title')}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const AssistantLineCard = memo(function AssistantLineCard({ a, onResolve }: { a: AssistantLine; onResolve: (a: AssistantLine) => void }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const openGap = a.status === 'discrepancy' && !a.resolved_at;
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: openGap ? colors.danger : colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{a.name}</Text>
        <StatusPill status={a.status} />
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
        {t('cash.collected_label', { amount: money(a.collected) })}
        {a.expenses > 0 ? ` · ${t('cash.expenses_label', { amount: money(a.expenses) })}` : ''}
        {a.registry !== null ? ` · ${t('cash.registry_label', { amount: money(a.registry) })}` : ''}
      </Text>
      {a.gap !== null && a.gap !== 0 ? (
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.danger, marginTop: 4 }}>{t('cash.gap')}: {money(a.gap)} {egp}</Text>
      ) : null}
      {a.reason ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{t('cash.reason_label', { reason: a.reason })}</Text> : null}
      {a.running_gap !== 0 ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark, marginTop: 2 }}>{t('cash.running_label', { amount: money(a.running_gap) })}</Text> : null}
      {a.responded_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{t('cash.answered_at', { when: formatDateTime(a.responded_at) })}</Text> : null}
      {a.resolved_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{t('cash.resolved_at', { when: formatDateTime(a.resolved_at) })}</Text> : null}
      {openGap ? (
        <TouchableOpacity onPress={() => onResolve(a)} activeOpacity={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brand, marginTop: spacing.sm }}>
          <Icon name="success" size={16} color={colors.brand} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('cash.resolve')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

function TeacherView({ v, onResolve }: { v: TeacherCashView; onResolve: (id: number, gap: number) => void }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const olderGaps = useMemo(() => v.open_gaps.filter((g) => g.week_start !== v.week.start), [v]);

  return (
    <>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: 4 }}>{t('cash.week_of', { start: formatShortDate(v.week.start), end: formatShortDate(v.week.end) })}</Text>
        <Figure label={t('cash.collected_teacher')} value={`${money(v.collected)} ${egp}`} strong />
        <Figure label={t('cash.expenses')} value={`${money(v.expenses)} ${egp}`} strong />
        {v.expenses_by_assistants > 0 ? <Figure label={`  ${t('cash.expenses_assistants')}`} value={`${money(v.expenses_by_assistants)} ${egp}`} /> : null}
        {v.expenses_by_teacher > 0 ? <Figure label={`  ${t('cash.expenses_teacher')}`} value={`${money(v.expenses_by_teacher)} ${egp}`} /> : null}
        <TouchableOpacity onPress={() => router.push('/(teacher)/expenses' as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
          <Icon name="note" size={16} color={colors.brand} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('expenses.title')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('cash.assistants_title')}</Text>
      {v.assistants.length === 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>{t('cash.no_assistants')}</Text>
      ) : (
        v.assistants.map((a) => <AssistantLineCard key={a.reconciliation_id} a={a} onResolve={(x) => onResolve(x.reconciliation_id, x.gap ?? 0)} />)
      )}

      {olderGaps.length > 0 ? (
        <>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('cash.open_gaps_title')}</Text>
          {olderGaps.map((g) => (
            <View key={g.reconciliation_id} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.danger, padding: spacing.md, marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{g.name}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.danger }}>{money(g.gap)} {egp}</Text>
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{t('cash.week_of', { start: formatShortDate(g.week_start), end: formatShortDate(g.week_end) })}</Text>
              {g.reason ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{t('cash.reason_label', { reason: g.reason })}</Text> : null}
              <TouchableOpacity onPress={() => onResolve(g.reconciliation_id, g.gap)} activeOpacity={0.85}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brand, marginTop: spacing.sm }}>
                <Icon name="success" size={16} color={colors.brand} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('cash.resolve')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      ) : null}

      {v.running_gaps.length > 0 ? (
        <View style={{ backgroundColor: colors.warning + '14', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.warning, padding: spacing.lg, marginTop: spacing.lg }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginBottom: 2 }}>{t('cash.running_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('cash.running_hint')}</Text>
          {v.running_gaps.map((r) => (
            <Figure key={r.user_id} label={r.name} value={`${money(r.gap)} ${egp}`} tint={colors.danger} />
          ))}
        </View>
      ) : null}
    </>
  );
}

export default function CashReconcileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['cash-reconciliation'], queryFn: () => getCashReconciliation() });
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cash-reconciliation'] });
    qc.invalidateQueries({ queryKey: ['expenses'] });
  };

  const resolve = useMutation({
    mutationFn: (id: number) => resolveReconciliation(id),
    onSuccess: () => { invalidate(); Alert.alert(t('cash.resolved')); },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });

  const confirmResolve = (id: number, gap: number) => {
    Alert.alert(t('cash.resolve_confirm_title'), t('cash.resolve_confirm_hint', { amount: money(gap) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('cash.resolve'), onPress: () => resolve.mutate(id) },
    ]);
  };

  const onDone = (status: ReconciliationStatus) => {
    invalidate();
    Alert.alert(status === 'confirmed' ? t('cash.confirmed_done') : t('cash.sent_diff'));
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('cash.title')}</Text>
      </View>

      {isLoading || !data ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {data.role === 'assistant' ? <AssistantView v={data} onDone={onDone} /> : <TeacherView v={data} onResolve={confirmResolve} />}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
