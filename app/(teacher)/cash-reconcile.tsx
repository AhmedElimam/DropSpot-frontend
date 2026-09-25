import { memo, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView, Switch } from 'react-native';
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
  getCashReconciliation, respondReconciliation, resolveReconciliation, setOpeningBalance, recordHandover, reviewHandover, updateCashSettings, getCashInsights,
  type AssistantCashView, type TeacherCashView, type Drawer, type TeacherDrawer, type Handover, type ReconciliationResult, type ReconciliationStatus, type VenueRef, type Observation,
} from '@/api/cash';

/**
 * Weekly cash reconciliation (spec 2026-09-25 + addenda). One screen, two shapes decided
 * by the SERVER's `role`:
 *
 *  · assistant — one card per DRAWER (one, or one per venue) with every line of the
 *    arithmetic: opening + collected − expenses − handovers = expected. Then «هل هذا
 *    المبلغ في الخزنة؟». "No" asks what IS there and why. Their own figures only.
 *    Plus their handovers to the teacher (a transfer, not an expense).
 *  · teacher — settings, every drawer with the full arithmetic and its result, handovers
 *    to confirm, the opening-balance entry when it is unknown, open gaps, and running
 *    deficit/surplus per assistant kept SEPARATE.
 *
 * Colours are the spec's: deficit red, balanced green, surplus AMBER — a surplus is a
 * warning that something was not recorded, never good news.
 */

const money = (v: number) => formatNumber(v, { maximumFractionDigits: 2 });
const INTRO_KEY = 'cash_intro_seen_v1';

const RESULT_TINT: Record<ReconciliationResult, string> = {
  deficit: colors.danger, balanced: colors.success, surplus: colors.warning, unknown: colors.textTertiary,
};
const STATUS_TINT: Record<ReconciliationStatus, string> = {
  confirmed: colors.success, discrepancy: colors.danger, pending: colors.warning, not_reconciled: colors.warning, awaiting_opening: colors.textTertiary,
};

const Figure = memo(function Figure({ label, value, strong, tint, dim }: { label: string; value: string; strong?: boolean; tint?: string; dim?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ fontFamily: strong ? fonts.bold : fonts.regular, fontSize: 14, color: dim ? colors.textTertiary : colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: strong ? 17 : 15, color: tint ?? (dim ? colors.textTertiary : colors.textPrimary) }}>{value}</Text>
    </View>
  );
});

const Rule = () => <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: 4 }} />;

function ResultPill({ d }: { d: Drawer }) {
  const { t } = useTranslation();
  if (d.result && d.result !== 'unknown') {
    const tint = RESULT_TINT[d.result];
    return (
      <View style={{ backgroundColor: tint + '22', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: tint }}>{t(`cash.${d.result}`)}{d.difference !== null && d.result !== 'balanced' ? ` ${money(Math.abs(d.difference))}` : ''}</Text>
      </View>
    );
  }
  const tint = STATUS_TINT[d.status];
  return (
    <View style={{ backgroundColor: tint + '22', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: tint }}>{t(`cash.${d.status}`)}</Text>
    </View>
  );
}

/** The §5 arithmetic, every line visible. */
function Arithmetic({ d }: { d: Drawer }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const known = d.opening_balance !== null;
  return (
    <View>
      <Figure label={t('cash.opening')} value={known ? `${money(d.opening_balance as number)} ${egp}` : t('cash.opening_unknown')} tint={known ? undefined : colors.warningDark} />
      <Figure label={t('cash.collected')} value={`+ ${money(d.collected)} ${egp}`} />
      {d.expenses > 0 ? <Figure label={t('cash.expenses')} value={`− ${money(d.expenses)} ${egp}`} /> : null}
      {d.handovers > 0 ? <Figure label={t('cash.handovers')} value={`− ${money(d.handovers)} ${egp}`} /> : null}
      <Rule />
      <Figure label={t('cash.expected')} value={d.expected !== null ? `${money(d.expected)} ${egp}` : t('cash.cannot_compute')} strong tint={d.expected !== null ? colors.brand : colors.warningDark} />
      {d.registry !== null ? <Figure label={t('cash.actual')} value={`${money(d.registry)} ${egp}`} strong /> : null}
      {d.registry !== null && d.difference !== null && d.result ? (
        <>
          <Rule />
          <Figure label={t(`cash.${d.result}`)} value={`${d.difference > 0 ? '+' : ''}${money(d.difference)} ${egp}`} strong tint={RESULT_TINT[d.result]} />
        </>
      ) : null}
      {!known ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark, marginTop: 4 }}>
          {d.opening_reason === 'previous_unreconciled' ? t('cash.opening_prev_unreconciled') : t('cash.opening_first_week')}
        </Text>
      ) : null}
    </View>
  );
}

/** Amber, with the one question that matters and a direct path to record the missed collection. */
function SurplusNotice({ d }: { d: Drawer }) {
  const { t } = useTranslation();
  if (d.result !== 'surplus') return null;
  return (
    <View style={{ backgroundColor: colors.warning + '18', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.warning, padding: spacing.md, marginTop: spacing.sm }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.warningDark }}>{t('cash.surplus_question')}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{t('cash.surplus_hint')}</Text>
      <TouchableOpacity onPress={() => router.push('/(teacher)/pending-collections' as Href)} activeOpacity={0.85}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.md, backgroundColor: colors.warning, marginTop: spacing.sm }}>
        <Icon name="money" size={16} color="#fff" />
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('cash.surplus_record')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function DrawerTitle({ d, name }: { d: Drawer; name?: string }) {
  const { t } = useTranslation();
  const title = [name, d.venue?.name ?? (name ? undefined : t('cash.week_of', { start: formatShortDate(d.week_start), end: formatShortDate(d.week_end) }))].filter(Boolean).join(' · ');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{title}</Text>
        {name ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('cash.week_of', { start: formatShortDate(d.week_start), end: formatShortDate(d.week_end) })}</Text> : null}
      </View>
      <ResultPill d={d} />
    </View>
  );
}

/** The assistant's prompt card for ONE drawer — the two-button question, then the difference form. */
function PromptCard({ row, onDone }: { row: Drawer; onDone: (d: Drawer) => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'ask' | 'diff'>(row.expected === null ? 'diff' : 'ask');
  // Pre-filled count (v2 §5): the expected figure is in the box already; the person edits or confirms.
  const [registry, setRegistry] = useState(row.expected !== null ? String(row.expected) : '');
  const [reason, setReason] = useState('');

  const registryNum = Number(registry);
  const diff = row.expected !== null && Number.isFinite(registryNum) && registry !== '' ? Math.round((registryNum - row.expected) * 100) / 100 : null;
  const needsReason = diff !== null && Math.abs(diff) > row.tolerance && reason.trim() === '';

  const respond = useMutation({
    mutationFn: (payload: { full: true } | { full: false; registry: number; reason?: string }) => respondReconciliation(row.id, payload),
    onSuccess: (d) => onDone(d),
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.warning, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm }}>
      <DrawerTitle d={row} />
      <Arithmetic d={row} />

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
          {row.expected !== null ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.brand, marginBottom: 4 }}>{t('cash.prefilled_hint', { amount: money(row.expected) })}</Text> : null}
          <TextInput
            value={registry}
            onChangeText={(v) => setRegistry(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder={t('cash.actual_placeholder')}
            placeholderTextColor={colors.textTertiary}
            style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'right', marginBottom: spacing.sm }}
          />
          {diff !== null ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: Math.abs(diff) <= row.tolerance ? colors.success : diff < 0 ? colors.danger : colors.warningDark, marginBottom: spacing.sm }}>
              {Math.abs(diff) <= row.tolerance ? t('cash.no_gap_preview') : `${t(diff < 0 ? 'cash.deficit' : 'cash.surplus')}: ${money(Math.abs(diff))} ${t('insights.egp')}`}
            </Text>
          ) : null}
          {row.tolerance > 0 && row.expected !== null ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('cash.tolerance_note', { amount: money(row.tolerance) })}</Text> : null}
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
            disabled={registry === '' || !Number.isFinite(registryNum) || needsReason}
            loading={respond.isPending}
          />
          {row.expected !== null ? (
            <TouchableOpacity onPress={() => setMode('ask')} style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

const HandoverRow = memo(function HandoverRow({ h, onReview }: { h: Handover; onReview?: (h: Handover, d: 'confirm' | 'reject') => void }) {
  const { t } = useTranslation();
  const tint = h.status === 'confirmed' ? colors.success : h.status === 'rejected' ? colors.danger : colors.warning;
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: onReview ? colors.warning : colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{money(h.amount)} {t('insights.egp')}{h.assistant_name ? ` · ${h.assistant_name}` : ''}</Text>
        <View style={{ backgroundColor: tint + '22', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: tint }}>{t(`cash.handover_${h.status}`)}</Text>
        </View>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
        {formatShortDate(h.handover_date)}{h.venue?.name ? ` · ${h.venue.name}` : ''}{h.note ? ` · ${h.note}` : ''}
      </Text>
      {onReview ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}><Button title={t('cash.handover_confirm')} variant="success" onPress={() => onReview(h, 'confirm')} /></View>
          <View style={{ flex: 1 }}><Button title={t('cash.handover_reject')} variant="outline" onPress={() => onReview(h, 'reject')} /></View>
        </View>
      ) : null}
    </View>
  );
});

/** Amount + optional venue + note → a handover. The teacher also picks WHICH assistant. */
function HandoverForm({ venues, perVenue, assistants, onSaved }: { venues: VenueRef[]; perVenue: boolean; assistants?: { user_id: number; name: string }[]; onSaved: (status: Handover['status']) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [venueId, setVenueId] = useState<number | null>(null);
  const [assistantId, setAssistantId] = useState<number | null>(assistants?.[0]?.user_id ?? null);
  const amountNum = Number(amount);

  const save = useMutation({
    mutationFn: () => recordHandover({ amount: amountNum, note: note.trim() || undefined, assistant_user_id: assistantId ?? undefined, teacher_location_id: perVenue ? venueId : undefined }),
    onSuccess: (r) => { setAmount(''); setNote(''); setOpen(false); onSaved(r.status); },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });

  if (!open) {
    return (
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.85}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brand, marginBottom: spacing.md }}>
        <Icon name="transfer" size={18} color={colors.brand} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{assistants ? t('cash.handover_received') : t('cash.handover_add')}</Text>
      </TouchableOpacity>
    );
  }

  const chip = (on: boolean, label: string, onPress: () => void, key: string | number) => (
    <TouchableOpacity key={key} onPress={onPress} activeOpacity={0.8}
      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brand + '18' : colors.surface }}>
      <Text style={{ fontFamily: on ? fonts.bold : fonts.regular, fontSize: 13, color: on ? colors.brand : colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, marginBottom: 2 }}>{assistants ? t('cash.handover_received') : t('cash.handover_add')}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('cash.handover_not_expense')}</Text>
      {assistants ? (
        <>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{t('cash.pick_assistant')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm }}>
            {assistants.map((a) => chip(assistantId === a.user_id, a.name, () => setAssistantId(a.user_id), a.user_id))}
          </View>
        </>
      ) : null}
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{t('cash.handover_amount')}</Text>
      <TextInput value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textTertiary}
        style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'right', marginBottom: spacing.sm }} />
      {perVenue && venues.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm }}>
          {chip(venueId === null, t('cash.drawer_general'), () => setVenueId(null), 'g')}
          {venues.map((v) => chip(venueId === v.id, v.name ?? '', () => setVenueId(v.id), v.id))}
        </View>
      ) : null}
      <TextInput value={note} onChangeText={setNote} placeholder={t('cash.handover_note')} placeholderTextColor={colors.textTertiary} maxLength={300}
        style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'right', marginBottom: spacing.sm }} />
      <Button title={t('cash.handover_submit')} onPress={() => save.mutate()} disabled={!(amountNum > 0) || (!!assistants && !assistantId)} loading={save.isPending} />
      <TouchableOpacity onPress={() => setOpen(false)} style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('common.cancel')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function AssistantView({ v, onDone, onHandover }: { v: AssistantCashView; onDone: (d: Drawer) => void; onHandover: (s: Handover['status']) => void }) {
  const { t } = useTranslation();
  const answered = v.drawers.filter((d) => d.registry !== null);

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

      {answered.map((d) => (
        <View key={d.id} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: d.result && d.result !== 'unknown' ? RESULT_TINT[d.result] : colors.border, padding: spacing.lg, marginBottom: spacing.lg }}>
          <DrawerTitle d={d} />
          <Arithmetic d={d} />
          {d.status === 'awaiting_opening' ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{t('cash.answered_registry_hint', { amount: money(d.registry ?? 0) })}</Text> : null}
          <SurplusNotice d={d} />
          {d.reason ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 6 }}>{t('cash.reason_label', { reason: d.reason })}</Text> : null}
          {d.responded_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>{t('cash.answered_at', { when: formatDateTime(d.responded_at) })}</Text> : null}
        </View>
      ))}

      {v.unanswered.length === 0 && answered.length === 0 ? (
        v.drawers.length > 0 ? (
          v.drawers.map((d) => (
            <View key={d.id} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg }}>
              <DrawerTitle d={d} />
              <Arithmetic d={d} />
            </View>
          ))
        ) : (
          <EmptyState icon="success" title={t('cash.no_prompt')} message={t('cash.no_prompt_hint')} />
        )
      ) : null}

      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.md, marginBottom: spacing.sm }}>{t('cash.handovers')}</Text>
      <HandoverForm venues={v.venues} perVenue={v.settings.per_venue} onSaved={onHandover} />
      {v.handovers.map((h) => <HandoverRow key={h.id} h={h} />)}

      {v.settings.expenses_enabled ? (
        <TouchableOpacity onPress={() => router.push('/(teacher)/expenses' as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md }}>
          <Icon name="note" size={16} color={colors.brand} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('expenses.title')}</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );
}

/** What she has noticed (v2 §6). Each line opens the entries behind it — a remark you cannot verify is worth nothing. */
function Observations({ items }: { items: Observation[] }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  const open = (o: Observation) => router.push({ pathname: '/(teacher)/expenses', params: { from: o.trace.from, to: o.trace.to, ...(o.trace.category ? { category: o.trace.category } : {}), ...(o.trace.venue !== undefined ? { venue: String(o.trace.venue) } : {}) } } as Href);
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('cash.observations_title')}</Text>
      {items.map((o) => (
        <TouchableOpacity key={o.key} onPress={() => open(o)} activeOpacity={0.85}
          style={{ backgroundColor: o.type === 'streak' ? colors.success + '14' : colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: o.type === 'streak' ? colors.success : colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, lineHeight: 22 }}>{o.text}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Icon name="search" size={13} color={colors.brand} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('cash.observation_open')}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function OpeningEntry({ d, onSaved }: { d: TeacherDrawer; onSaved: () => void }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const n = Number(amount);
  const save = useMutation({
    mutationFn: () => setOpeningBalance(d.id, n),
    onSuccess: () => { Alert.alert(t('cash.opening_saved')); onSaved(); },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  return (
    <View style={{ marginTop: spacing.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.md }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{t('cash.opening_set')}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{t('cash.opening_set_hint')}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <TextInput value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textTertiary}
          style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, textAlign: 'right', backgroundColor: colors.surface }} />
        <Button title={t('common.save')} onPress={() => save.mutate()} disabled={amount === '' || !Number.isFinite(n)} loading={save.isPending} />
      </View>
    </View>
  );
}

function TeacherDrawerCard({ d, onResolve, onChanged }: { d: TeacherDrawer; onResolve: (d: TeacherDrawer) => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const openGap = d.status === 'discrepancy' && !d.resolved_at;
  const border = d.result && d.result !== 'unknown' && d.registry !== null ? RESULT_TINT[d.result] : colors.border;
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: border, padding: spacing.lg, marginBottom: spacing.md }}>
      <DrawerTitle d={d} name={d.name} />
      <Arithmetic d={d} />
      {d.opening_balance === null && !d.resolved_at ? <OpeningEntry d={d} onSaved={onChanged} /> : null}
      <SurplusNotice d={d} />
      {d.reason ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 6 }}>{t('cash.reason_label', { reason: d.reason })}</Text> : null}
      {d.responded_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>{t('cash.answered_at', { when: formatDateTime(d.responded_at) })}</Text> : null}
      {d.resolved_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{t('cash.resolved_at', { when: formatDateTime(d.resolved_at) })}</Text> : null}
      {openGap ? (
        <TouchableOpacity onPress={() => onResolve(d)} activeOpacity={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brand, marginTop: spacing.sm }}>
          <Icon name="success" size={16} color={colors.brand} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('cash.resolve')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function SettingsCard({ v, onChanged }: { v: TeacherCashView; onChanged: () => void }) {
  const { t } = useTranslation();
  const [tol, setTol] = useState(String(v.settings.tolerance));
  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateCashSettings>[0]) => updateCashSettings(patch),
    onSuccess: onChanged,
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  const rowStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 8 };
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: 4 }}>{t('cash.settings_title')}</Text>
      <View style={rowStyle}>
        <View style={{ flex: 1, paddingEnd: spacing.md }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('cash.setting_expenses')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('cash.setting_expenses_hint')}</Text>
        </View>
        <Switch value={v.settings.expenses_enabled} onValueChange={(on) => save.mutate({ expenses_enabled: on })} disabled={save.isPending} />
      </View>
      <View style={rowStyle}>
        <View style={{ flex: 1, paddingEnd: spacing.md }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('cash.setting_per_venue')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('cash.setting_per_venue_hint')}</Text>
        </View>
        <Switch value={v.settings.per_venue} onValueChange={(on) => save.mutate({ expenses_per_venue: on })} disabled={save.isPending || v.venues.length === 0} />
      </View>
      {v.settings.expenses_enabled ? (
        <View style={rowStyle}>
          <View style={{ flex: 1, paddingEnd: spacing.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('cash.setting_reminder')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('cash.setting_reminder_hint')}</Text>
          </View>
          <Switch value={v.settings.expense_reminder_enabled !== false} onValueChange={(on) => save.mutate({ expense_reminder_enabled: on })} disabled={save.isPending} />
        </View>
      ) : null}
      <View style={rowStyle}>
        <View style={{ flex: 1, paddingEnd: spacing.md }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('cash.setting_insights')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('cash.setting_insights_hint')}</Text>
        </View>
        <Switch value={v.settings.insights_enabled !== false} onValueChange={(on) => save.mutate({ insights_enabled: on })} disabled={save.isPending} />
      </View>
      {v.settings.insights_enabled !== false ? (
        <View style={rowStyle}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('cash.setting_insight_pushes')}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[0, 1, 2, 3].map((n) => {
              const on = (v.settings.insight_pushes_per_day ?? 1) === n;
              return (
                <TouchableOpacity key={n} onPress={() => save.mutate({ insight_pushes_per_day: n })} style={{ width: 34, height: 30, borderRadius: radius.md, borderWidth: 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brand + '18' : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.brand : colors.textPrimary }}>{money(n)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
      <View style={rowStyle}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('cash.setting_tolerance')}</Text>
        <TextInput value={tol} onChangeText={(x) => setTol(x.replace(/[^0-9.]/g, ''))} onBlur={() => { const n = Number(tol); if (Number.isFinite(n) && n !== v.settings.tolerance) save.mutate({ cash_tolerance: n }); }}
          keyboardType="decimal-pad" style={{ width: 90, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 6, textAlign: 'center' }} />
      </View>
    </View>
  );
}

function TeacherView({ v, onResolve, onChanged, onReview, onHandover }: { v: TeacherCashView; onResolve: (id: number, amount: number) => void; onChanged: () => void; onReview: (h: Handover, d: 'confirm' | 'reject') => void; onHandover: (s: Handover['status']) => void }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const olderGaps = useMemo(() => v.open_gaps.filter((g) => g.week_start !== v.week.start), [v]);

  return (
    <>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: 4 }}>{t('cash.week_of', { start: formatShortDate(v.week.start), end: formatShortDate(v.week.end) })}</Text>
        <Figure label={t('cash.collected_teacher')} value={`${money(v.collected)} ${egp}`} strong />
        {v.settings.expenses_enabled ? (
          <>
            <Figure label={t('cash.expenses')} value={`${money(v.expenses)} ${egp}`} strong />
            {v.expenses_by_assistants > 0 ? <Figure label={`  ${t('cash.expenses_assistants')}`} value={`${money(v.expenses_by_assistants)} ${egp}`} /> : null}
            {v.expenses_by_teacher > 0 ? <Figure label={`  ${t('cash.expenses_teacher')}`} value={`${money(v.expenses_by_teacher)} ${egp}`} /> : null}
            {v.unassigned_expenses > 0 ? <Figure label={`  ${t('cash.unassigned_expenses')}`} value={`${money(v.unassigned_expenses)} ${egp}`} dim /> : null}
          </>
        ) : null}
        {v.handovers_confirmed > 0 ? <Figure label={t('cash.handovers')} value={`${money(v.handovers_confirmed)} ${egp}`} /> : null}
        {v.settings.expenses_enabled ? (
          <TouchableOpacity onPress={() => router.push('/(teacher)/expenses' as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
            <Icon name="note" size={16} color={colors.brand} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('expenses.title')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {v.pending_handovers.length > 0 ? (
        <>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: 2 }}>{t('cash.handover_pending_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('cash.handover_pending_hint')}</Text>
          {v.pending_handovers.map((h) => <HandoverRow key={h.id} h={h} onReview={onReview} />)}
        </>
      ) : null}

      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('cash.assistants_title')}</Text>
      {v.drawers.length === 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>{t('cash.no_assistants')}</Text>
      ) : (
        v.drawers.map((d) => <TeacherDrawerCard key={d.id} d={d} onResolve={(x) => onResolve(x.id, Math.abs(x.difference ?? 0))} onChanged={onChanged} />)
      )}

      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.md, marginBottom: spacing.sm }}>{t('cash.handovers')}</Text>
      {v.assistants.length > 0 ? <HandoverForm venues={v.venues} perVenue={v.settings.per_venue} assistants={v.assistants} onSaved={onHandover} /> : null}
      {v.week_handovers.map((h) => <HandoverRow key={h.id} h={h} />)}

      {olderGaps.length > 0 ? (
        <>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('cash.open_gaps_title')}</Text>
          {olderGaps.map((g) => <TeacherDrawerCard key={g.id} d={g} onResolve={(x) => onResolve(x.id, Math.abs(x.difference ?? 0))} onChanged={onChanged} />)}
        </>
      ) : null}

      {v.running_totals.length > 0 ? (
        <View style={{ backgroundColor: colors.warning + '14', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.warning, padding: spacing.lg, marginTop: spacing.lg }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginBottom: 2 }}>{t('cash.running_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('cash.running_hint')}</Text>
          {v.running_totals.map((r) => (
            <View key={r.user_id} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.warning + '33' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{r.name}</Text>
              {r.deficit_weeks > 0 ? <Figure label={`${t('cash.running_deficits')} · ${t('cash.running_weeks', { count: r.deficit_weeks })}`} value={`− ${money(r.deficit_total)} ${egp}`} tint={colors.danger} /> : null}
              {r.surplus_weeks > 0 ? <Figure label={`${t('cash.running_surpluses')} · ${t('cash.running_weeks', { count: r.surplus_weeks })}`} value={`+ ${money(r.surplus_total)} ${egp}`} tint={colors.warningDark} /> : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        <SettingsCard v={v} onChanged={onChanged} />
      </View>
    </>
  );
}

export default function CashReconcileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['cash-reconciliation'], queryFn: () => getCashReconciliation() });
  const insightsQ = useQuery({ queryKey: ['cash-insights'], queryFn: getCashInsights });
  const { refreshing, onRefresh } = usePullRefresh(refetch, insightsQ.refetch);
  const ins = insightsQ.data;
  // First open: مدام روز introduces herself once (persona spec §5), then steps aside.
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  useEffect(() => {
    SecureStore.getItemAsync(INTRO_KEY).then((v) => setIntroSeen(!!v)).catch(() => setIntroSeen(true));
  }, []);
  const dismissIntro = () => { setIntroSeen(true); SecureStore.setItemAsync(INTRO_KEY, '1').catch(() => {}); };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cash-reconciliation'] });
    qc.invalidateQueries({ queryKey: ['cash-insights'] });
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['teacher-insights'] });
  };

  const resolve = useMutation({
    mutationFn: (id: number) => resolveReconciliation(id),
    onSuccess: () => { invalidate(); Alert.alert(t('cash.resolved')); },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  const review = useMutation({
    mutationFn: ({ id, d }: { id: number; d: 'confirm' | 'reject' }) => reviewHandover(id, d),
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });

  const confirmResolve = (id: number, amount: number) => {
    Alert.alert(t('cash.resolve_confirm_title'), t('cash.resolve_confirm_hint', { amount: money(amount) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('cash.resolve'), onPress: () => resolve.mutate(id) },
    ]);
  };

  // Persona for the good news, PLAIN for a deficit or surplus (spec §4).
  const onDone = (d: Drawer) => {
    invalidate();
    if (d.status === 'confirmed') Alert.alert(t('cash.balanced_persona'));
    else if (d.status === 'awaiting_opening') Alert.alert(t('cash.awaiting_opening'));
    else if (d.result === 'surplus') Alert.alert(t('cash.surplus_plain', { amount: money(Math.abs(d.difference ?? 0)) }), t('cash.surplus_question'));
    else Alert.alert(t('cash.deficit_plain', { amount: money(Math.abs(d.difference ?? 0)) }));
  };
  const onHandover = (s: Handover['status']) => {
    invalidate();
    Alert.alert(s === 'confirmed' ? t('cash.handover_saved_confirmed') : t('cash.handover_saved_pending'));
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('cash.screen_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: -2 }}>{t('cash.persona_name')}</Text>
        </View>
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
          {ins?.context?.greeting ? (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{ins.context.greeting}</Text>
              {ins.context.season ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{ins.context.season}</Text> : null}
            </View>
          ) : null}
          {introSeen === false ? (
            <View style={{ backgroundColor: colors.brand + '12', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.brand + '44', padding: spacing.lg, marginBottom: spacing.lg }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('cash.intro_line1')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 22 }}>{t('cash.intro_line2')}</Text>
              <TouchableOpacity onPress={dismissIntro} style={{ alignSelf: 'flex-start', marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.brand }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('cash.intro_dismiss')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {ins?.enabled ? <Observations items={ins.observations} /> : null}
          {data.role === 'assistant'
            ? <AssistantView v={data} onDone={onDone} onHandover={onHandover} />
            : <TeacherView v={data} onResolve={confirmResolve} onChanged={invalidate} onReview={(h, d) => review.mutate({ id: h.id, d })} onHandover={onHandover} />}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
