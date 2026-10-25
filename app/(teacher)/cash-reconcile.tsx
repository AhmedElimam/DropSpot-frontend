import { useDialogPersona } from '@/ui/dialog';
import { SheetModal } from '@/components/ui/SheetModal';
import { memo, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Switch } from 'react-native';
import { Alert } from '@/ui/dialog';
import { ScrollView } from '@/components/ui/Refreshable';
import { router, type Href } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { getCashMonth, type CollectionEvent, type KindTotals, type RegistryNow, type CashMonth } from '@/api/cash';
import { formatShortDate, formatDateTime, formatNumber } from '@/utils/format';
import { colors, spacing, radius, nav, shadows, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { isNetworkFailure } from '@/db/marksSync';
import { ExpensesPanel } from '@/components/cash/ExpensesPanel';
import { RoseComplaintsPanel } from '@/components/cash/RoseComplaintsPanel';
import { RoseStamp, RosePortrait, useStampBurst } from '@/components/rose/RoseStamp';
import { RoseHero, RoseHeroCard, useRoseHold } from '@/components/rose/RoseHero';
import { useRoseExport, ExportPill } from '@/components/rose/RoseExport';
import { useRoseDialog } from '@/components/rose/RoseDialog';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useRose } from '@/hooks/useRose';
import { useRevisionActive } from '@/hooks/useRevisionTheme';
import { useRevisions } from '@/hooks/useRevisions';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { countdown, nextExam, revisionFacts } from '@/utils/revisionDesk';
import { countdownText } from '@/components/teacher/RevisionDesk';
import { useArrived } from '@/hooks/useArrived';
import { useTutorials } from '@/hooks/useTutorials';
import { useComplaints } from '@/hooks/useComplaints';
import { getFriendlyErrorMessage } from '@/utils/errors';
import {
  getCashReconciliation, respondReconciliation, setOpeningBalance, setOpeningFor, clearOpeningBalance, recordHandover, reviewHandover, updateCashSettings, getCashInsights, getRoseSheet,
  type AssistantCashView, type TeacherCashView, type OpeningBoardEntry, type Drawer, type TeacherDrawer, type Handover, type ReconciliationResult, type ReconciliationStatus, type VenueRef, type Observation, type CashView,
} from '@/api/cash';
import { Surface } from '@/ui/surfaces';

/**
 * مدام روز — her DESK (founder 2026-10-07: «she has more than the cash keeping now»). ONE
 * screen, no hopping:
 *
 *   hero      her portrait and greeting, the week, «ورقة النهارده» (today's sheet, read on
 *             demand from the same tables as her 11 am push), a gear for settings
 *   now       the single thing that needs this person right now — the assistant's count
 *             (answered right here), or the teacher's confirmations and reviews
 *   segments  الخزنة · المصاريف · الاعتراضات · ملاحظاتها — everything else, in place
 *   sheets    handover and settings slide up over the screen instead of leaving it
 *   stamps    her navy stamp on what is in her cash book (a balanced count, a confirmed
 *             handover, a closed week), thumping onto the card the moment it lands
 *
 * The maths, the voice rules and who-sees-what are unchanged: the server decides the
 * shape (`role`), figures are computed there, and an assistant's payload carries only
 * their own drawers. This file is only how it looks and how few taps it takes.
 */

const money = (v: number) => formatNumber(v, { maximumFractionDigits: 2 });
const INTRO_KEY = 'cash_intro_seen_v1';
type Segment = 'week' | 'expenses' | 'complaints' | 'notes';

const RESULT_TINT = (): Record<ReconciliationResult, string> => ({
  deficit: colors.danger, balanced: colors.success, surplus: colors.warning, unknown: colors.textTertiary,
});
const STATUS_TINT = (): Record<ReconciliationStatus, string> => ({
  confirmed: colors.success, discrepancy: colors.danger, pending: colors.warning, not_reconciled: colors.warning, awaiting_opening: colors.textTertiary,
});
const SHEET_BACKDROP = 'rgba(23,28,59,0.45)';

// ───────────────────────── small pieces ─────────────────────────

const Figure = memo(function Figure({ label, value, strong, tint, dim }: { label: string; value: string; strong?: boolean; tint?: string; dim?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ fontFamily: strong ? fonts.bold : fonts.regular, fontSize: 14, color: dim ? colors.textTertiary : colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: strong ? 17 : 15, color: tint ?? (dim ? colors.textTertiary : colors.textPrimary) }}>{value}</Text>
    </View>
  );
});

const Rule = () => <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: 4 }} />;

function Pill({ text, tint }: { text: string; tint: string }) {
  return (
    <View style={{ backgroundColor: tint + '22', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: tint }}>{text}</Text>
    </View>
  );
}

function ResultPill({ d }: { d: Drawer }) {
  const { t } = useTranslation();
  if (d.result && d.result !== 'unknown' && d.registry !== null) {
    return <Pill tint={RESULT_TINT()[d.result]} text={`${t(`cash.${d.result}`)}${d.difference !== null && d.result !== 'balanced' ? ` ${money(Math.abs(d.difference))}` : ''}`} />;
  }
  return <Pill tint={STATUS_TINT()[d.status]} text={t(`cash.${d.status}`)} />;
}

/** Two big figures side by side — what the eye needs first. */
function BigPair({ left, right }: { left: { label: string; value: string; tint?: string }; right: { label: string; value: string; tint?: string } }) {
  const cell = (c: { label: string; value: string; tint?: string }) => (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{c.label}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: c.tint ?? colors.textPrimary, marginTop: 2 }}>{c.value}</Text>
    </View>
  );
  return <View style={{ flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm }}>{cell(left)}{cell(right)}</View>;
}

/** The §5 arithmetic, every line visible — behind a "details" toggle so the card stays light. */
function Arithmetic({ d }: { d: Drawer }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const known = d.opening_balance !== null;
  return (
    <View>
      <Figure label={t('cash.opening')} value={known ? `${money(d.opening_balance as number)} ${egp}` : t('cash.opening_unknown')} tint={known ? undefined : colors.warningDark} />
      <Figure label={t('cash.collected')} value={`+ ${money(d.collected)} ${egp}`} />
      {d.expenses > 0 ? <Figure label={t('cash.expenses')} value={`− ${money(d.expenses)} ${egp}`} /> : null}
      {(d.held ?? 0) > 0 ? <Figure label={t('review.held')} value={`− ${money(d.held ?? 0)} ${egp}`} tint={colors.warningDark} /> : null}
      {(d.rejected_expenses ?? 0) > 0 ? <Figure label={t('review.rejected')} value={money(d.rejected_expenses ?? 0)} tint={colors.danger} dim /> : null}
      {d.is_teacher_drawer && d.handovers < 0 ? <Figure label={t('cash.handovers_received')} value={`+ ${money(-d.handovers)} ${egp}`} tint={colors.success} /> : null}
      {!d.is_teacher_drawer && d.handovers > 0 ? <Figure label={t('cash.handovers')} value={`− ${money(d.handovers)} ${egp}`} /> : null}
      <Rule />
      {d.expected !== null ? (
        <Figure label={t('cash.expected')} value={`${money(d.expected)} ${egp}`} strong tint={colors.brand} />
      ) : (
        <Figure label={t('cash.net_movement')} value={`${(d.net_movement ?? 0) > 0 ? '+' : ''}${money(d.net_movement ?? 0)} ${egp}`} strong tint={colors.warningDark} />
      )}
      {d.collected_by_kind ? <KindChips k={d.collected_by_kind} /> : null}
      {d.registry !== null ? <Figure label={t('cash.actual')} value={`${money(d.actual ?? d.registry)} ${egp}`} strong /> : null}
      {d.registry !== null && d.difference !== null && d.result ? (
        <>
          <Rule />
          <Figure label={t(`cash.${d.result}`)} value={`${d.difference > 0 ? '+' : ''}${money(d.difference)} ${egp}`} strong tint={RESULT_TINT()[d.result]} />
        </>
      ) : null}
      {!known ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark, marginTop: 4 }}>
          {d.opening_reason === 'previous_unreconciled' ? t('cash.opening_prev_unreconciled') : t('cash.opening_first_week')}
        </Text>
      ) : d.opening_source === 'assumed_zero' || d.opening_source === 'carried_expected' ? (
        // The opening is automatic; say where it came from so nobody wonders who typed it.
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: d.opening_source === 'carried_expected' ? colors.warningDark : colors.textTertiary, marginTop: 4 }}>
          {d.opening_source === 'assumed_zero' ? t('cash.opening_assumed_zero') : t('cash.opening_carried_expected')}
        </Text>
      ) : null}
    </View>
  );
}

function SurplusNotice({ d }: { d: Drawer }) {
  const { t } = useTranslation();
  if (d.result !== 'surplus') return null;
  return (
    <Surface id="teacher.cash_reconcile.drawer_surplus_notice">
    <View style={{ backgroundColor: colors.warning + '18', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.warning, padding: spacing.md, marginTop: spacing.sm }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.warningDark }}>{t('cash.surplus_question')}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{t('cash.surplus_hint')}</Text>
      <Surface id="teacher.cash_reconcile.surplus_record_button">
      <TouchableOpacity onPress={() => router.push('/(teacher)/pending-collections' as Href)} activeOpacity={0.85}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.md, backgroundColor: colors.warning, marginTop: spacing.sm }}>
        <Icon name="money" size={16} color="#fff" />
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('cash.surplus_record')}</Text>
      </TouchableOpacity>
      </Surface>
    </View>
    </Surface>
  );
}

function Details({ d, extra }: { d: Drawer; extra?: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Surface id="teacher.cash_reconcile.drawer_details">
    <View>
      <TouchableOpacity onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Icon name={open ? 'up' : 'down'} size={14} color={colors.brand} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('cash.details')}</Text>
      </TouchableOpacity>
      {open ? (
        <View style={{ marginTop: 4 }}>
          <Arithmetic d={d} />
          {extra}
          {d.reason ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 6 }}>{t('cash.reason_label', { reason: d.reason })}</Text> : null}
          {d.responded_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>{t('cash.answered_at', { when: formatDateTime(d.responded_at) })}</Text> : null}
        </View>
      ) : null}
    </View>
    </Surface>
  );
}

// ───────────────────────── the assistant's count, answered in place ─────────────────────────

/** `onOpeningSaved`: the teacher counting their OWN drawer may set its opening here too. */
function PromptCard({ row, onDone, onOpeningSaved }: { row: Drawer; onDone: (d: Drawer) => void; onOpeningSaved?: () => void }) {
  const { t } = useTranslation();
  const rose = useRose();
  const egp = t('insights.egp');
  const [mode, setMode] = useState<'ask' | 'diff'>(row.expected === null ? 'diff' : 'ask');
  const [registry, setRegistry] = useState(row.expected !== null ? String(row.expected) : '');
  // A new opening moves the expected figure: the prefilled count follows it.
  useEffect(() => { setRegistry(row.expected !== null ? String(row.expected) : ''); }, [row.expected]);
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
    <Surface id="teacher.cash_reconcile.prompt_card">
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadows.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="money" size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('cash.banner_pending', { rose: rose.name })}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('cash.week_of', { start: formatShortDate(row.week_start), end: formatShortDate(row.week_end) })}{row.venue?.name ? ` · ${row.venue.name}` : ''}</Text>
        </View>
      </View>

      <BigPair
        left={{ label: t('cash.collected'), value: money(row.collected) }}
        right={{ label: t('cash.expected'), value: row.expected !== null ? money(row.expected) : '—', tint: row.expected !== null ? colors.brand : colors.warningDark }}
      />
      {onOpeningSaved && row.is_teacher_drawer && !row.closed_at ? <OpeningRow d={row} onSaved={onOpeningSaved} /> : null}
      {row.expected === null ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark, marginBottom: spacing.sm }}>
          {row.opening_reason === 'previous_unreconciled' ? t('cash.opening_prev_unreconciled') : t('cash.opening_first_week')}
        </Text>
      ) : null}

      {mode === 'ask' ? (
        <>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, textAlign: 'center', marginVertical: spacing.sm }}>{t('cash.question')}</Text>
          {/* Compact pair sized to the card: the full-size Button wrapped its label at half width. */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Surface id="teacher.cash_reconcile.prompt_yes_full_button">
            <TouchableOpacity onPress={() => respond.mutate({ full: true })} disabled={respond.isPending} activeOpacity={0.85}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, backgroundColor: colors.success, opacity: respond.isPending ? 0.6 : 1 }}>
              {respond.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="success" size={16} color="#fff" />}
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }} numberOfLines={1}>{t('cash.yes_full')}</Text>
            </TouchableOpacity>
            </Surface>
            <Surface id="teacher.cash_reconcile.prompt_no_diff_button">
            <TouchableOpacity onPress={() => setMode('diff')} disabled={respond.isPending} activeOpacity={0.85}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brand }}>
              <Icon name="note" size={16} color={colors.brand} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }} numberOfLines={1}>{t('cash.no_diff')}</Text>
            </TouchableOpacity>
            </Surface>
          </View>
        </>
      ) : (
        <View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{t('cash.registry')}</Text>
          <TextInput value={registry} onChangeText={(v) => setRegistry(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder={t('cash.actual_placeholder')} placeholderTextColor={colors.textTertiary}
            style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'center', marginBottom: spacing.sm, backgroundColor: colors.surfaceSunken }} />
          {diff !== null ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, textAlign: 'center', color: Math.abs(diff) <= row.tolerance ? colors.success : diff < 0 ? colors.danger : colors.warningDark, marginBottom: spacing.sm }}>
              {Math.abs(diff) <= row.tolerance ? t('cash.no_gap_preview') : `${t(diff < 0 ? 'cash.deficit' : 'cash.surplus')}: ${money(Math.abs(diff))} ${egp}`}
            </Text>
          ) : null}
          <TextInput value={reason} onChangeText={setReason} placeholder={t('cash.reason_placeholder')} placeholderTextColor={colors.textTertiary} maxLength={500} multiline
            style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'right', minHeight: 56, marginBottom: spacing.sm }} />
          {needsReason ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.danger, marginBottom: spacing.sm }}>{t('cash.reason_required')}</Text> : null}
          <Surface id="teacher.cash_reconcile.prompt_submit_button">
          <Button title={t('cash.submit')} onPress={() => respond.mutate({ full: false, registry: registryNum, reason: reason.trim() || undefined })}
            disabled={registry === '' || !Number.isFinite(registryNum) || needsReason} loading={respond.isPending} />
          </Surface>
          {row.expected !== null ? (
            <TouchableOpacity onPress={() => setMode('ask')} style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
    </Surface>
  );
}

// ───────────────────────── drawers ─────────────────────────

/**
 * «الرصيد الافتتاحي» of the week, on the card itself (founder 2026-10-23: a custom opening for
 * the week): the figure, automatic or custom, and a tap to set it, change it, or give it back to
 * the automatic one. Teacher only, until the week is closed.
 */
function OpeningRow({ d, onSaved }: { d: Drawer; onSaved: () => void }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const [open, setOpen] = useState(false);
  const custom = d.opening_source === 'teacher';
  return (
    <>
      <Surface id="teacher.cash_reconcile.opening_row">
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('cash.opening_sheet_title')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, marginBottom: spacing.sm }}>
        <Icon name="money" size={16} color={colors.brand} />
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>{t('cash.opening')}</Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: d.opening_balance === null ? colors.warningDark : colors.textPrimary }}>
          {d.opening_balance === null ? t('cash.opening_unknown') : `${money(d.opening_balance)} ${egp}`}
        </Text>
        <Pill text={custom ? t('cash.opening_custom') : t('cash.opening_auto')} tint={custom ? colors.accent : colors.textTertiary} />
        <Icon name="note" size={15} color={colors.brand} />
      </TouchableOpacity>
      </Surface>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('cash.opening_sheet_title')}>
        <OpeningSheetBody d={d} onDone={() => { setOpen(false); onSaved(); }} />
      </Sheet>
    </>
  );
}

/** What the opening sheet works on: a drawer's row, or — before it has one this week — its holder. */
type OpeningTarget = {
  id: number | null;
  holder_id?: number;
  opening_balance: number | null;
  opening_source: Drawer['opening_source'];
  opening_auto?: number | null;
  week_start?: string;
  week_end?: string;
};

function OpeningSheetBody({ d, onDone }: { d: OpeningTarget; onDone: () => void }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const custom = d.opening_source === 'teacher';
  // What the automatic rule gives: the current figure, or — beside a custom one — opening_auto.
  const auto = custom ? (d.opening_auto ?? null) : d.opening_balance;
  const why = custom ? t('cash.opening_src_any')
    : d.opening_source === 'carried' ? t('cash.opening_src_carried')
    : d.opening_source === 'carried_expected' ? t('cash.opening_carried_expected')
    : d.opening_source === 'assumed_zero' ? t('cash.opening_src_zero') : null;
  const [amount, setAmount] = useState(custom && d.opening_balance !== null ? String(d.opening_balance) : '');
  const n = Number(amount);
  const onError = (e: unknown) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
  const save = useMutation({ mutationFn: () => (d.id !== null ? setOpeningBalance(d.id, n) : setOpeningFor(d.holder_id as number, n)), onSuccess: onDone, onError });
  const reset = useMutation({ mutationFn: () => clearOpeningBalance(d.id as number), onSuccess: onDone, onError });
  return (
    <View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.textSecondary }}>{t('cash.opening_set_hint')}</Text>
      {d.week_start && d.week_end ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{t('cash.week_of', { start: formatShortDate(d.week_start), end: formatShortDate(d.week_end) })}</Text> : null}
      {auto !== null ? (
        <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{t('cash.opening_auto_is')}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{money(auto)} {egp}</Text>
          </View>
          {why ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>{why}</Text> : null}
        </View>
      ) : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: 6 }}>{t('cash.opening_custom_label')}</Text>
      <TextInput value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder={auto !== null ? money(auto) : '0'} placeholderTextColor={colors.textTertiary}
        style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, textAlign: 'right', backgroundColor: colors.surface }} />
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 6 }}>{t('cash.opening_custom_note')}</Text>
      <View style={{ marginTop: spacing.lg }}>
        <Button title={t('cash.opening_save')} onPress={() => save.mutate()} disabled={amount === '' || !Number.isFinite(n) || reset.isPending} loading={save.isPending} />
      </View>
      {custom && d.id !== null ? (
        <TouchableOpacity onPress={() => reset.mutate()} disabled={reset.isPending || save.isPending} accessibilityRole="button"
          style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}>
          {reset.isPending ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon name="refresh" size={15} color={colors.brand} />}
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('cash.opening_reset')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * The week's «الرصيد الافتتاحي» card, at the top of the week (founder 2026-10-23: «where's the
 * opening balance button?» — a drawer has its own card only once something happened in it that
 * week). Every drawer — the teacher's own first, then each assistant's — with its opening,
 * automatic or custom; a tap opens the same sheet as the drawer card's row. Teacher only.
 */
function OpeningBoard({ v, onChanged }: { v: TeacherCashView; onChanged: () => void }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const [target, setTarget] = useState<OpeningBoardEntry | null>(null);
  const entries = v.opening_board ?? [];
  if (entries.length === 0) return null;
  return (
    <Surface id="teacher.cash_reconcile.opening_board">
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="money" size={17} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('cash.opening_sheet_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('cash.opening_board_hint')}</Text>
        </View>
      </View>
      {entries.map((e, i) => {
        const custom = e.opening_source === 'teacher';
        return (
          <TouchableOpacity key={`${e.holder_id}:${e.venue?.id ?? 0}`} onPress={() => setTarget(e)} disabled={e.closed} activeOpacity={0.8} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: i === 0 ? spacing.sm : 0, opacity: e.closed ? 0.55 : 1 }}>
            <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{[e.name, e.venue?.name].filter(Boolean).join(' · ')}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: e.opening_balance === null ? colors.warningDark : colors.textPrimary }}>
              {e.opening_balance === null ? t('cash.opening_unknown') : `${money(e.opening_balance)} ${egp}`}
            </Text>
            <Pill text={custom ? t('cash.opening_custom') : t('cash.opening_auto')} tint={custom ? colors.accent : colors.textTertiary} />
            <Icon name={e.closed ? 'lock' : 'note'} size={15} color={e.closed ? colors.textTertiary : colors.brand} />
          </TouchableOpacity>
        );
      })}
      <Sheet open={target !== null} onClose={() => setTarget(null)} title={target ? `${t('cash.opening_sheet_title')} — ${target.name}` : ''}>
        {target ? <OpeningSheetBody d={{ ...target, week_start: v.week.start, week_end: v.week.end }} onDone={() => { setTarget(null); onChanged(); }} /> : null}
      </Sheet>
    </View>
    </Surface>
  );
}

/** One drawer, light: who · where, the two figures, the verdict, one button. */
function DrawerCard({ d, name, isTeacher, onChanged, freshStamp = false }: { d: Drawer | TeacherDrawer; name?: string; isTeacher: boolean; onChanged: () => void; freshStamp?: boolean }) {
  const { t } = useTranslation();
  const answered = d.registry !== null;
  const tint = d.result && d.result !== 'unknown' && answered ? RESULT_TINT()[d.result] : colors.border;
  // In her book: the count balanced, or the week is closed. `freshStamp` = it happened just now → the thump.
  const stamped = (answered && d.status === 'confirmed') || !!d.closed_at;
  const reviewWaiting = d.review_pending ?? 0;
  const openReview = () => router.push({ pathname: '/(teacher)/cash-review', params: { id: String(d.id) } } as Href);

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: tint, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{[name, d.venue?.name].filter(Boolean).join(' · ') || t('cash.week_of', { start: formatShortDate(d.week_start), end: formatShortDate(d.week_end) })}</Text>
          {name ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('cash.week_of', { start: formatShortDate(d.week_start), end: formatShortDate(d.week_end) })}</Text> : null}
        </View>
        {stamped ? <Surface id="teacher.cash_reconcile.drawer_stamp"><RoseStamp ink="navy" size={44} animate={freshStamp} style={{ marginEnd: spacing.xs }} /></Surface> : null}
        <ResultPill d={d} />
      </View>
      <BigPair
        left={d.expected !== null
          ? { label: t('cash.expected'), value: money(d.expected), tint: colors.brand }
          : { label: t('cash.net_movement'), value: `${(d.net_movement ?? 0) > 0 ? '+' : ''}${money(d.net_movement ?? 0)}`, tint: colors.warningDark }}
        right={{ label: t('cash.actual'), value: answered ? money(d.actual ?? d.registry ?? 0) : '—', tint: answered && d.result && d.result !== 'unknown' ? RESULT_TINT()[d.result] : undefined }}
      />
      {isTeacher && !d.closed_at ? <OpeningRow d={d} onSaved={onChanged} /> : null}
      <SurplusNotice d={d} />
      <Details d={d} />
      {/* The weekly review is the teacher's screen only (founder 2026-09-26); an assistant
          follows their expenses, and answers questions, from the expenses list. */}
      {isTeacher ? (
        <Surface id="teacher.cash_reconcile.open_review_button">
        <TouchableOpacity onPress={openReview} activeOpacity={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, marginTop: spacing.sm, backgroundColor: reviewWaiting > 0 ? colors.brand : colors.surfaceSunken }}>
          <Icon name={d.closed_at ? 'lock' : 'eye'} size={16} color={reviewWaiting > 0 ? '#fff' : colors.brand} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: reviewWaiting > 0 ? '#fff' : colors.brand }}>
            {d.closed_at ? t('review.closed') : reviewWaiting > 0 ? t('review.waiting', { count: money(reviewWaiting) }) : t('review.open')}
          </Text>
        </TouchableOpacity>
        </Surface>
      ) : null}
    </View>
  );
}

// ───────────────────────── the collections behind the figures ─────────────────────────

const KIND_ORDER: (keyof KindTotals)[] = ['bill', 'booklet', 'booking', 'guest_pass'];

/** Collected, by what it paid for — bills / booklets / bookings / guest passes. */
function KindChips({ k }: { k: KindTotals }) {
  const { t } = useTranslation();
  const shown = KIND_ORDER.filter((key) => (k[key] ?? 0) !== 0);
  if (shown.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {shown.map((key) => (
        <View key={key} style={{ borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSunken, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }}>{t(`cash.kind_${key}`)} {money(k[key])}</Text>
        </View>
      ))}
    </View>
  );
}

/** «What should be in the registries now» — by default, before anyone counts. */
function RegistryNowCard({ r, byKind }: { r: RegistryNow; byKind?: KindTotals }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.brand, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('cash.registry_now')}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.brand, marginTop: 2 }}>{money(r.total_known)} {egp}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
        {t('cash.registry_split', { drawers: money(r.drawers_known), hand: money(r.teacher_hand) })}
      </Text>
      {r.drawers_unknown_count > 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark, marginTop: 4 }}>
          {t('cash.registry_unknown', { count: r.drawers_unknown_count, net: money(r.drawers_net) })}
        </Text>
      ) : null}
      {byKind ? <KindChips k={byKind} /> : null}
    </View>
  );
}

/** The collection events themselves, newest first — every figure above is a sum of these. */
function CollectionsList({ events, byKind, own }: { events: CollectionEvent[]; byKind?: KindTotals; own: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const shown = open ? events : events.slice(0, 5);
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{own ? t('cash.collections_mine') : t('cash.collections_title')}</Text>
      {byKind ? <KindChips k={byKind} /> : null}
      {events.length === 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 6 }}>{t('cash.collections_empty')}</Text>
      ) : (
        shown.map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>
                {e.student?.name || (e.kind === 'guest_pass' ? t('cash.kind_guest_pass') : '—')}
                <Text style={{ fontFamily: fonts.regular, color: colors.textSecondary }}> · {e.kind_label}{e.method === 'digital' ? ` · ${t('cash.method_digital')}` : ''}</Text>
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }} numberOfLines={1}>
                {formatDateTime(e.collected_at)}{!own && e.collector ? ` · ${e.collector.is_me ? t('cash.me') : e.collector.name}` : ''}{e.venue ? ` · ${e.venue}` : ''}
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: e.is_reversal ? colors.danger : colors.textPrimary }}>{e.is_reversal ? '' : '+'}{money(e.amount)}</Text>
          </View>
        ))
      )}
      {events.length > 5 ? (
        <TouchableOpacity onPress={() => setOpen((o) => !o)} style={{ alignSelf: 'center', paddingVertical: 6 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{open ? t('cash.show_less') : t('cash.show_all', { count: events.length })}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ───────────────────────── handovers ─────────────────────────

const HandoverRow = memo(function HandoverRow({ h, onReview }: { h: Handover; onReview?: (h: Handover, d: 'confirm' | 'reject') => void }) {
  const { t } = useTranslation();
  const tint = h.status === 'confirmed' ? colors.success : h.status === 'rejected' ? colors.danger : colors.warning;
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: onReview ? colors.warning : colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{money(h.amount)} {t('insights.egp')}{h.assistant_name ? ` · ${h.assistant_name}` : ''}</Text>
        {h.status === 'confirmed' ? <RoseStamp ink="navy" size={38} style={{ marginEnd: spacing.xs }} /> : null}
        <Pill tint={tint} text={t(`cash.handover_${h.status}`)} />
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
        {formatShortDate(h.handover_date)}{h.venue?.name ? ` · ${h.venue.name}` : ''}{h.note ? ` · ${h.note}` : ''}
      </Text>
      {onReview ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          {/* The same compact pair as the count prompt above, not the full-size Button. */}
          <Surface id="teacher.cash_reconcile.handover_confirm_button">
          <TouchableOpacity onPress={() => onReview(h, 'confirm')} activeOpacity={0.85} accessibilityRole="button"
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.success }}>
            <Icon name="success" size={16} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff', flexShrink: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{t('cash.handover_confirm')}</Text>
          </TouchableOpacity>
          </Surface>
          <Surface id="teacher.cash_reconcile.handover_reject_button">
          <TouchableOpacity onPress={() => onReview(h, 'reject')} activeOpacity={0.85} accessibilityRole="button"
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 44, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brand }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{t('cash.handover_reject')}</Text>
          </TouchableOpacity>
          </Surface>
        </View>
      ) : null}
    </View>
  );
});

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}
      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brand + '18' : colors.surface }}>
      <Text style={{ fontFamily: on ? fonts.bold : fonts.regular, fontSize: 13, color: on ? colors.brand : colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Slides up over the screen; the person never leaves the hub. */
function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <SheetModal visible={open} onClose={onClose} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.xl, paddingBottom: spacing.xl + insets.bottom, maxHeight: '88%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Icon name="close" size={22} color={colors.textTertiary} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
    </SheetModal>
  );
}

function HandoverSheetBody({ venues, perVenue, assistants, onSaved }: { venues: VenueRef[]; perVenue: boolean; assistants?: { user_id: number; name: string }[]; onSaved: (s: Handover['status']) => void }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [venueId, setVenueId] = useState<number | null>(null);
  const [assistantId, setAssistantId] = useState<number | null>(assistants?.[0]?.user_id ?? null);
  const amountNum = Number(amount);
  const save = useMutation({
    mutationFn: () => recordHandover({ amount: amountNum, note: note.trim() || undefined, assistant_user_id: assistantId ?? undefined, teacher_location_id: perVenue ? venueId : undefined }),
    onSuccess: (r) => onSaved(r.status),
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  return (
    <View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md }}>{t('cash.handover_not_expense')}</Text>
      {assistants ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
          {assistants.map((a) => <Chip key={a.user_id} on={assistantId === a.user_id} label={a.name} onPress={() => setAssistantId(a.user_id)} />)}
        </View>
      ) : null}
      <TextInput value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textTertiary} autoFocus
        style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, textAlign: 'center', marginBottom: spacing.md, backgroundColor: colors.surfaceSunken }} />
      {perVenue && venues.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
          <Chip on={venueId === null} label={t('cash.drawer_general')} onPress={() => setVenueId(null)} />
          {venues.map((v) => <Chip key={v.id} on={venueId === v.id} label={v.name ?? ''} onPress={() => setVenueId(v.id)} />)}
        </View>
      ) : null}
      <TextInput value={note} onChangeText={setNote} placeholder={t('cash.handover_note')} placeholderTextColor={colors.textTertiary} maxLength={300}
        style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'right', marginBottom: spacing.md }} />
      <Button title={t('cash.handover_submit')} onPress={() => save.mutate()} disabled={!(amountNum > 0) || (!!assistants && !assistantId)} loading={save.isPending} />
    </View>
  );
}

// ───────────────────────── settings & notes ─────────────────────────

/** The app's switch: brand when on, the theme's border when off, white thumb — both schemes. */
function RoseSwitch({ value, onChange, disabled }: { value: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.brand, false: colors.border }} thumbColor="#FFFFFF" ios_backgroundColor={colors.border} />;
}

type SwitchKey = 'expenses_enabled' | 'expenses_per_venue' | 'expense_reminder_enabled' | 'insights_enabled' | 'rose_named' | 'rose_briefing_enabled';

/**
 * Her settings (founder 2026-10-08: «the toggles don't match the system colour, and they're
 * slow»). A switch flips the moment it is touched (its own state, independent of the others —
 * no more waiting for the server, and no more every switch locked while one saves); the
 * answer is merged into the cached cash views instead of reloading the whole desk. Only a
 * change that reshapes the desk (expenses on/off, per-venue) refreshes it. A refused change
 * flips back with the server's sentence.
 */
function SettingsBody({ v, onChanged }: { v: TeacherCashView; onChanged: () => void }) {
  const { t } = useTranslation();
  const rose = useRose();
  const qc = useQueryClient();
  const [tol, setTol] = useState(String(v.settings.tolerance));
  const [bulkMax, setBulkMax] = useState(String(v.settings.review_bulk_max ?? 500));
  const [local, setLocal] = useState<Partial<Record<SwitchKey | 'insight_pushes_per_day', boolean | number>>>({});
  const merge = (settings: Awaited<ReturnType<typeof updateCashSettings>>) => {
    qc.setQueriesData({ queryKey: ['cash-reconciliation'] }, (old: unknown) => {
      const o = old as { settings?: object } | undefined;
      return o && o.settings ? { ...o, settings: { ...o.settings, ...settings } } : old;
    });
  };
  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateCashSettings>[0]) => updateCashSettings(patch),
    onSuccess: merge,
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  const flip = (key: SwitchKey, value: boolean) => {
    setLocal((l) => ({ ...l, [key]: value }));
    updateCashSettings({ [key]: value }).then((settings) => {
      merge(settings);
      if (key === 'expenses_enabled' || key === 'expenses_per_venue') onChanged();
      else if (key === 'insights_enabled') qc.invalidateQueries({ queryKey: ['cash-insights'] });
    }).catch((e) => {
      setLocal((l) => ({ ...l, [key]: !value }));
      Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
    });
  };
  const on = (key: SwitchKey, server: boolean) => (local[key] as boolean | undefined) ?? server;
  const pushes = (local.insight_pushes_per_day as number | undefined) ?? v.settings.insight_pushes_per_day ?? 1;
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight };
  const label = (title: string, hint?: string) => (
    <View style={{ flex: 1, paddingEnd: spacing.md }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{title}</Text>
      {hint ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{hint}</Text> : null}
    </View>
  );
  const numeric = (value: string, set: (v: string) => void, commit: () => void) => (
    <TextInput value={value} onChangeText={(x) => set(x.replace(/[^0-9.]/g, ''))} onBlur={commit} keyboardType="decimal-pad"
      style={{ width: 90, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 6, textAlign: 'center' }} />
  );
  return (
    <View>
      <Surface id="teacher.cash_reconcile.setting_expenses"><View style={row}>{label(t('cash.setting_expenses'), t('cash.setting_expenses_hint'))}<RoseSwitch value={on('expenses_enabled', v.settings.expenses_enabled)} onChange={(x) => flip('expenses_enabled', x)} /></View></Surface>
      <Surface id="teacher.cash_reconcile.setting_per_venue"><View style={row}>{label(t('cash.setting_per_venue'), t('cash.setting_per_venue_hint'))}<RoseSwitch value={on('expenses_per_venue', v.settings.per_venue)} onChange={(x) => flip('expenses_per_venue', x)} disabled={v.venues.length === 0} /></View></Surface>
      {on('expenses_enabled', v.settings.expenses_enabled) ? (
        <Surface id="teacher.cash_reconcile.setting_reminder"><View style={row}>{label(t('cash.setting_reminder'), t('cash.setting_reminder_hint', { rose: rose.name }))}<RoseSwitch value={on('expense_reminder_enabled', v.settings.expense_reminder_enabled !== false)} onChange={(x) => flip('expense_reminder_enabled', x)} /></View></Surface>
      ) : null}
      <Surface id="teacher.cash_reconcile.setting_insights"><View style={row}>{label(t('cash.setting_insights', { rose: rose.name }), t('cash.setting_insights_hint'))}<RoseSwitch value={on('insights_enabled', v.settings.insights_enabled !== false)} onChange={(x) => flip('insights_enabled', x)} /></View></Surface>
      <Surface id="teacher.cash_reconcile.setting_rose_name"><View style={row}>{label(t('cash.setting_rose_name'), t('cash.setting_rose_name_hint'))}<RoseSwitch value={on('rose_named', v.settings.rose_named !== false)} onChange={(x) => flip('rose_named', x)} /></View></Surface>
      <Surface id="teacher.cash_reconcile.setting_briefing"><View style={row}>{label(t('cash.setting_briefing', { rose: rose.name }), t('cash.setting_briefing_hint'))}<RoseSwitch value={on('rose_briefing_enabled', v.settings.rose_briefing_enabled !== false)} onChange={(x) => flip('rose_briefing_enabled', x)} /></View></Surface>
      {on('insights_enabled', v.settings.insights_enabled !== false) ? (
        <Surface id="teacher.cash_reconcile.setting_insight_pushes">
        <View style={row}>{label(t('cash.setting_insight_pushes'))}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[0, 1, 2, 3].map((n) => {
              const sel = pushes === n;
              return (
                <TouchableOpacity key={n} onPress={() => { setLocal((l) => ({ ...l, insight_pushes_per_day: n })); save.mutate({ insight_pushes_per_day: n }); }} style={{ width: 34, height: 30, borderRadius: radius.md, borderWidth: 1, borderColor: sel ? colors.brand : colors.border, backgroundColor: sel ? colors.brand + '18' : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: sel ? colors.brand : colors.textPrimary }}>{money(n)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        </Surface>
      ) : null}
      <Surface id="teacher.cash_reconcile.setting_bulk_max"><View style={row}>{label(t('review.setting_bulk_max'), t('review.setting_bulk_max_hint'))}{numeric(bulkMax, setBulkMax, () => { const n = Number(bulkMax); if (Number.isFinite(n) && n !== (v.settings.review_bulk_max ?? 500)) save.mutate({ review_bulk_max: n }); })}</View></Surface>
      <Surface id="teacher.cash_reconcile.setting_tolerance"><View style={[row, { borderBottomWidth: 0 }]}>{label(t('cash.setting_tolerance'))}{numeric(tol, setTol, () => { const n = Number(tol); if (Number.isFinite(n) && n !== v.settings.tolerance) save.mutate({ cash_tolerance: n }); })}</View></Surface>
    </View>
  );
}

/**
 * ملاحظاتها — each note as a memo from her desk (founder 2026-10-07: «show her on her notes,
 * and her stamps»): her portrait beside it, the note in a bubble, her navy stamp in its
 * corner — it is written in her book. The notes stay facts about categories, venues and
 * trends (CashInsightsService); the stamp signs the memo, it does not grade anyone.
 */
function Observations({ items }: { items: Observation[] }) {
  const { t } = useTranslation();
  const rose = useRose();
  const open = (o: Observation) => router.push({ pathname: '/(teacher)/expenses', params: { from: o.trace.from, to: o.trace.to, ...(o.trace.category ? { category: o.trace.category } : {}), ...(o.trace.venue !== undefined ? { venue: String(o.trace.venue) } : {}) } } as Href);
  if (items.length === 0) return <EmptyState icon="info" title={t('cash.notes_none')} message={t('cash.notes_none_hint', { rose: rose.name })} />;
  return (
    <Surface id="teacher.cash_reconcile.observations">
    <View>
      {items.map((o, i) => {
        const streak = o.type === 'streak';
        return (
          <View key={o.key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md }}>
            {rose.named ? <RosePortrait size={40} nod={i === 0} style={{ marginTop: 2 }} /> : null}
            <TouchableOpacity onPress={() => open(o)} activeOpacity={0.85} accessibilityRole="button"
              style={{ flex: 1, backgroundColor: streak ? colors.success + '14' : colors.surface, borderRadius: radius.xl, borderTopStartRadius: rose.named ? 6 : radius.xl, borderWidth: 1, borderColor: streak ? colors.success : colors.border, padding: spacing.lg, ...shadows.sm }}>
              {/* Her name heads the memo on the right, where an Arabic note starts (founder 2026-10-09: «on notes of madam rose it still not RTL»). */}
              {rose.named ? <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.accent, marginBottom: 2 }}>{rose.name}</Text> : null}
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, lineHeight: 24 }}>{o.text}</Text>
              {/* The foot of the memo: «شوف التفاصيل», and her stamp at the bottom corner. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="search" size={13} color={colors.brand} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('cash.observation_open')}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <Surface id="teacher.cash_reconcile.observation_stamp"><RoseStamp ink="navy" size={44} tilt={-12} /></Surface>
              </View>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
    </Surface>
  );
}

// ───────────────────────── the screen ─────────────────────────

/** The single thing that needs this person right now. */
/**
 * Nothing waits on her desk — the «كله تمام» card. The same tests NowCard makes; مدام روز
 * sleeps over the week tab while it holds (founder 2026-10-25).
 */
function isDeskCalm(data: CashView): boolean {
  const answered = (d: Drawer) => d.is_answered ?? (d.registry !== null || (d.teacher_count ?? null) !== null);
  const openGap = (d: Drawer) => (d.is_open_gap ?? (d.status === 'discrepancy' && !d.resolved_at)) && !d.closed_at;
  if (data.role === 'assistant') {
    const gap = data.drawers.find(openGap);
    return !data.unanswered[0] && !(gap && gap.difference !== null);
  }
  const mine = data.drawers.filter((d) => !d.is_teacher_drawer);
  return data.pending_handovers.length === 0
    && !mine.some((d) => (d.review_pending ?? 0) > 0 || (!d.closed_at && answered(d)))
    && !mine.some((d) => !answered(d) && !d.closed_at)
    && !data.drawers.some((d) => d.is_teacher_drawer && !answered(d) && !d.closed_at)
    && !data.drawers.some((d) => d.is_teacher_drawer && openGap(d))
    && data.open_gaps.every((g) => g.week_start === data.week.start);
}

function NowCard({ data, onDone, onOpenHandovers, onCountOwn }: { data: CashView; onDone: (d: Drawer) => void; onOpenHandovers: () => void; onCountOwn: () => void }) {
  const { t } = useTranslation();
  if (data.role === 'assistant') {
    const row = data.unanswered[0];
    if (row) {
      return (
        <View>
          {row.week_start !== data.week.start ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('cash.late_answer_hint')}</Text> : null}
          <PromptCard row={row} onDone={onDone} />
        </View>
      );
    }
    // An open gap on their own drawer (counted by them, or by the teacher's own count) is
    // never «كله تمام» — it used to be, because only unanswered prompts were checked.
    const gap = data.drawers.find((d) => (d.is_open_gap ?? (d.status === 'discrepancy' && !d.resolved_at)) && !d.closed_at);
    if (gap && gap.difference !== null) {
      const deficit = gap.difference < 0;
      return (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 2, borderColor: deficit ? colors.danger : colors.warning, ...shadows.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: (deficit ? colors.danger : colors.warning) + '1F', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="warning" size={20} color={deficit ? colors.danger : colors.warningDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>
                {t(deficit ? 'cash.gap_own_deficit' : 'cash.gap_own_surplus', { amount: money(Math.abs(gap.difference)) })}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                {gap.registry === null ? t('cash.gap_own_teacher_counted') : t('cash.gap_own_hint')}
              </Text>
            </View>
          </View>
        </View>
      );
    }
    return <Calm text={t('cash.calm_assistant')} />;
  }
  const handovers = data.pending_handovers.length;
  // Everything that is still open — «كله تمام» only when ALL of these are empty. It used to look at
  // handovers and reviews only, so an uncounted drawer or an old open gap still read as «all fine».
  const assistantDrawers = data.drawers.filter((d) => !d.is_teacher_drawer);
  // «answered» means counted by the assistant OR by the teacher's own count flag.
  const answered = (d: Drawer) => d.is_answered ?? (d.registry !== null || (d.teacher_count ?? null) !== null);
  const waiting = assistantDrawers.filter((d) => (d.review_pending ?? 0) > 0 || (!d.closed_at && answered(d)));
  const first = waiting[0];
  const uncounted = assistantDrawers.filter((d) => !answered(d) && !d.closed_at);
  const ownToCount = data.drawers.find((d) => d.is_teacher_drawer && !answered(d) && !d.closed_at);
  const ownGap = data.drawers.find((d) => d.is_teacher_drawer && (d.is_open_gap ?? (d.status === 'discrepancy' && !d.resolved_at)) && !d.closed_at);
  const olderGaps = data.open_gaps.filter((g) => g.week_start !== data.week.start);
  if (isDeskCalm(data)) {
    const rn = data.registry_now;
    return <Calm text={t('cash.calm_teacher')} sub={rn && rn.total_known > 0 ? t('cash.calm_registry', { amount: money(rn.total_known) }) : undefined} />;
  }
  const row = (key: string, icon: 'transfer' | 'eye' | 'money' | 'warning', tint: string, title: string, sub: string, onPress?: () => void, divider = true) => (
    <TouchableOpacity key={key} onPress={onPress} disabled={!onPress} activeOpacity={0.85}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: divider ? 1 : 0, borderTopColor: colors.borderLight }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tint + '1F', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={tint} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{sub}</Text>
      </View>
      {onPress ? <Icon name="back" size={18} color={colors.textTertiary} /> : null}
    </TouchableOpacity>
  );
  const items: React.ReactNode[] = [];
  if (ownGap && ownGap.difference !== null) items.push(row('owngap', 'warning', ownGap.difference < 0 ? colors.danger : colors.warningDark,
    t(ownGap.difference < 0 ? 'cash.gap_own_deficit' : 'cash.gap_own_surplus', { amount: money(Math.abs(ownGap.difference)) }), t('cash.now_own_gap_hint'),
    () => router.push({ pathname: '/(teacher)/cash-review', params: { id: String(ownGap.id) } } as Href), items.length > 0));
  if (ownToCount) items.push(row('own', 'money', colors.accent, t('cash.now_own_count'), t('cash.now_own_count_hint'), onCountOwn, items.length > 0));
  if (olderGaps.length > 0) items.push(row('gaps', 'warning', colors.danger, t('cash.now_old_gaps', { count: money(olderGaps.length) }), t('cash.now_old_gaps_hint'),
    () => router.push({ pathname: '/(teacher)/cash-review', params: { id: String(olderGaps[0].id) } } as Href), items.length > 0));
  if (uncounted.length > 0) items.push(row('uncounted', 'money', colors.warningDark, t('cash.now_uncounted', { count: money(uncounted.length) }),
    uncounted.map((d) => d.name).join('، '), undefined, items.length > 0));
  if (handovers === 0 && !first) {
    return (
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadows.md }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('cash.now_title')}</Text>
        {items}
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadows.md }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('cash.now_title')}</Text>
      {handovers > 0 ? (
        <Surface id="teacher.cash_reconcile.now_handovers_row">
        <TouchableOpacity onPress={onOpenHandovers} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.warning + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name="transfer" size={20} color={colors.warning} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('cash.now_handovers', { count: money(handovers) })}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('cash.handover_pending_hint')}</Text>
          </View>
          <Icon name="back" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        </Surface>
      ) : null}
      {first ? (
        <Surface id="teacher.cash_reconcile.now_review_row">
        <TouchableOpacity onPress={() => router.push({ pathname: '/(teacher)/cash-review', params: { id: String(first.id) } } as Href)} activeOpacity={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: handovers > 0 ? 1 : 0, borderTopColor: colors.borderLight }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brand + '18', alignItems: 'center', justifyContent: 'center' }}><Icon name="eye" size={20} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('cash.now_review', { name: first.name, count: money(waiting.length) })}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{(first.review_pending ?? 0) > 0 ? t('review.waiting', { count: money(first.review_pending ?? 0) }) : t('cash.now_review_hint')}</Text>
          </View>
          <Icon name="back" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        </Surface>
      ) : null}
      {items.length > 0 ? <View style={{ borderTopWidth: 1, borderTopColor: colors.borderLight }}>{items}</View> : null}
    </View>
  );
}

function Calm({ text, sub }: { text: string; sub?: string }) {
  // On the canvas now (it used to sit inside the hero), so a surface card with a green tile.
  return (
    <Surface id="teacher.cash_reconcile.calm_card">
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...shadows.sm }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="success" size={22} color={colors.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{text}</Text>
        {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      <Surface id="teacher.cash_reconcile.calm_stamp"><RoseStamp ink="navy" size={48} /></Surface>
    </View>
    </Surface>
  );
}

// ───────────────────────── past periods ─────────────────────────

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Week / month switch, previous / next. */
function PeriodBar({ period, label, canNext, onPeriod, onPrev, onNext }: {
  period: 'week' | 'month'; label: string; canNext: boolean; onPeriod: (p: 'week' | 'month') => void;
  onPrev: () => void; onNext: () => void;
}) {
  const { t } = useTranslation();
  const arrow = (icon: 'forward' | 'back', onPress: () => void, disabled = false) => (
    <TouchableOpacity onPress={onPress} disabled={disabled} hitSlop={6}
      style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
      <Icon name={icon} size={18} color={colors.brand} />
    </TouchableOpacity>
  );
  return (
    <Surface id="teacher.cash_reconcile.period_bar">
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.sm }}>
        {(['week', 'month'] as const).map((p) => (
          <TouchableOpacity key={p} onPress={() => onPeriod(p)} activeOpacity={0.85}
            style={{ flex: 1, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: period === p ? colors.brand : colors.surfaceSunken }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: period === p ? '#fff' : colors.textSecondary }}>{t(p === 'week' ? 'cash.period_week' : 'cash.period_month')}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* RTL: «forward» (›) points to the previous period on the right, «back» (‹) to the next one. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {arrow('forward', onPrev)}
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{label}</Text>
        {arrow('back', onNext, !canNext)}
      </View>
    </View>
    </Surface>
  );
}

/** A month at a glance: totals by where and what, then its weeks (tap one to open it). */
function MonthView({ m, onOpenWeek }: { m: CashMonth; onOpenWeek: (weekStart: string) => void }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const tt = m.totals;
  return (
    <Surface id="teacher.cash_reconcile.month_view">
    <View>
      <Surface id="teacher.cash_reconcile.month_totals_card">
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.brand, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('cash.month_collected')}</Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.brand, marginTop: 2 }}>{money(tt.collected)} {egp}</Text>
        {m.role === 'teacher' ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            {t('cash.collected_split', { assistants: money(tt.cash_by_assistants ?? 0), teacher: money(tt.cash_by_teacher ?? 0) })}
            {(tt.digital ?? 0) > 0 ? ` · ${t('cash.collected_digital', { amount: money(tt.digital ?? 0) })}` : ''}
          </Text>
        ) : null}
        <KindChips k={tt.by_kind} />
        <View style={{ marginTop: spacing.sm }}>
          <Figure label={t('cash.expenses')} value={`${money(tt.expenses)} ${egp}`} />
          <Figure label={t('cash.handovers')} value={`${money(tt.handovers)} ${egp}`} />
          {tt.deficit > 0 ? <Figure label={t('cash.deficit')} value={`− ${money(tt.deficit)} ${egp}`} tint={colors.danger} /> : null}
          {tt.surplus > 0 ? <Figure label={t('cash.surplus')} value={`+ ${money(tt.surplus)} ${egp}`} tint={colors.warningDark} /> : null}
          {(tt.uncounted ?? 0) > 0 ? <Figure label={t('cash.month_uncounted')} value={money(tt.uncounted ?? 0)} tint={colors.warningDark} /> : null}
        </View>
        {tt.expenses_by_category.length > 0 ? (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textTertiary, marginBottom: 2 }}>{t('cash.month_expense_cats')}</Text>
            {tt.expenses_by_category.map((c) => <Figure key={c.key} label={c.label} value={`${money(c.amount)} ${egp}`} dim />)}
          </View>
        ) : null}
      </View>
      </Surface>

      <Surface id="teacher.cash_reconcile.month_weeks">
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('cash.month_weeks')}</Text>
      {m.weeks.length === 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, textAlign: 'center', marginVertical: spacing.lg }}>{t('cash.month_no_weeks')}</Text>
      ) : m.weeks.map((w) => (
        <TouchableOpacity key={w.week_start} onPress={() => onOpenWeek(w.week_start)} activeOpacity={0.85}
          style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
              {t('cash.week_of', { start: formatShortDate(w.week_start), end: formatShortDate(w.week_end) })}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              {t('cash.month_week_line', { collected: money(w.collected), expenses: money(w.expenses), counted: money(w.counted), drawers: money(w.drawers) })}
            </Text>
            {w.deficit > 0 || w.surplus > 0 ? (
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: w.deficit > 0 ? colors.danger : colors.warningDark, marginTop: 2 }}>
                {[w.deficit > 0 ? `${t('cash.deficit')} ${money(w.deficit)}` : '', w.surplus > 0 ? `${t('cash.surplus')} ${money(w.surplus)}` : ''].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
          {w.closed ? <RoseStamp ink="navy" size={36} /> : null}
          <Icon name="back" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      ))}
      </Surface>
    </View>
    </Surface>
  );
}

export default function CashReconcileScreen() {
  // Every popup here is مدام روز's (the system alert replacement, src/ui/dialog.tsx).
  useDialogPersona('rose');
  const { t } = useTranslation();
  const rose = useRose();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  // The page slides in light — her still portrait, the segments — and the heavy parts (her live
  // face, the segment's cards) mount once it has arrived (founder 2026-10-08: «slow on click
  // from the homepage to her tab» on mid-range phones).
  const arrived = useArrived();
  const roseVideo = (useTutorials().data ?? []).some((c) => c.key === 'rose');
  const hold = useRoseHold();
  // «وضع المراجعة»: the facts on her desk — sessions this week, exams ahead, the next one's
  // distance. Facts only (she never grades the teacher); none while the season is off.
  const season = useRevisionActive();
  const seasonNow = useMinuteClock();
  const seasonRevisions = useRevisions(season).data ?? [];
  const seasonLines = useMemo(() => {
    if (!season) return undefined;
    const facts = revisionFacts(seasonRevisions, seasonNow);
    const next = nextExam(seasonRevisions, seasonNow);
    return [
      t('revision.rose_week', { n: formatNumber(facts.thisWeek) }),
      t('revision.rose_exams', { n: formatNumber(facts.examsAhead) }),
      next ? t('revision.rose_next', { when: countdownText(countdown(next.at, seasonNow), t) }) : t('revision.rose_none'),
    ];
  }, [season, seasonRevisions, seasonNow, t]);
  // Period filter (founder 2026-09-25): this week by default; step back through past weeks or months.
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const weekDay = useMemo(() => isoDay(addDays(new Date(), -7 * weekOffset)), [weekOffset]);
  const monthKey = useMemo(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - monthOffset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }, [monthOffset]);
  // The current week lives under the same key Home and «الإدارة» fetch it with, so a copy
  // saved from either serves her desk offline (founder 2026-10-10: «madam rose offline
  // doesn't save» — the old key «now» was hers alone).
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: weekOffset === 0 ? ['cash-reconciliation'] : ['cash-reconciliation', weekDay], queryFn: () => getCashReconciliation(weekOffset === 0 ? undefined : weekDay) });
  const monthQ = useQuery({ queryKey: ['cash-month', monthKey], queryFn: () => getCashMonth(monthKey), enabled: period === 'month' });
  const isPast = period === 'month' || weekOffset > 0;
  const insightsQ = useQuery({ queryKey: ['cash-insights'], queryFn: getCashInsights });
  // «ورقة النهارده» — read now, in this reader's scope; nothing stored, no push spent.
  const sheetQ = useQuery({ queryKey: ['rose-sheet'], queryFn: getRoseSheet, staleTime: 60_000 });
  const complaintsQ = useComplaints('pending');
  const { refreshing, onRefresh } = usePullRefresh(refetch, insightsQ.refetch, monthQ.refetch, sheetQ.refetch, complaintsQ.refetch);
  const ins = insightsQ.data;
  const sheet = sheetQ.data ?? null;
  const { burst, burstNode } = useStampBurst();
  // «تصدير PDF»: the whole desk from the top bar, each section from its own corner.
  const { busy: exporting, exportPdf } = useRoseExport();
  // Her confirmations and what she reports back, in her own popup (founder 2026-10-08).
  const { ask, tell, dialog } = useRoseDialog();
  const weekParam = weekOffset > 0 ? { week: weekDay } : {};
  // The drawer whose count just landed in her book — its card gets the thump, once.
  const [freshStamp, setFreshStamp] = useState<number | null>(null);
  const [segment, setSegment] = useState<Segment>('week');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  useEffect(() => {
    SecureStore.getItemAsync(INTRO_KEY).then((v) => setIntroSeen(!!v)).catch(() => setIntroSeen(true));
  }, []);
  const dismissIntro = () => { setIntroSeen(true); SecureStore.setItemAsync(INTRO_KEY, '1').catch(() => {}); };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cash-reconciliation'] });
    qc.invalidateQueries({ queryKey: ['cash-month'] });
    qc.invalidateQueries({ queryKey: ['cash-insights'] });
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['teacher-insights'] });
  };
  const review = useMutation({
    mutationFn: ({ id, d }: { id: number; d: 'confirm' | 'reject' }) => reviewHandover(id, d),
    onSuccess: (_, { d }) => { invalidate(); if (d === 'confirm') burst('navy', t('cash.stamp_handover', { rose: rose.name })); },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  const onDone = (d: Drawer) => {
    invalidate();
    if (d.status === 'confirmed') {
      // Balanced: her stamp lands — the flash, then the card keeps it. Her sentence stays the same.
      setFreshStamp(d.id);
      if (!burst('navy', t('cash.balanced_persona'))) void tell(t('cash.balanced_persona'));
    } else if (d.status === 'awaiting_opening') void tell(t('cash.awaiting_opening'));
    else if (d.result === 'surplus') void tell(t('cash.surplus_plain', { amount: money(Math.abs(d.difference ?? 0)) }), t('cash.surplus_question'));
    else void tell(t('cash.deficit_plain', { amount: money(Math.abs(d.difference ?? 0)) }));
  };
  const onHandover = (s: Handover['status']) => {
    setHandoverOpen(false); invalidate();
    if (s === 'confirmed' && burst('navy', t('cash.handover_saved_confirmed'))) return;
    void tell(s === 'confirmed' ? t('cash.handover_saved_confirmed') : t('cash.handover_saved_pending'));
  };

  const expensesOn = data?.settings.expenses_enabled !== false;
  const complaintsPending = complaintsQ.data?.counts.pending ?? 0;
  const segments = useMemo(() => ([
    { key: 'week' as Segment, label: t('cash.seg_week'), icon: 'money' as const, badge: 0 },
    ...(expensesOn ? [{ key: 'expenses' as Segment, label: t('expenses.title'), icon: 'note' as const, badge: 0 }] : []),
    { key: 'complaints' as Segment, label: t('cash.seg_complaints'), icon: 'tickets' as const, badge: complaintsPending },
    { key: 'notes' as Segment, label: t('cash.seg_notes'), icon: 'star' as const, badge: ins?.enabled ? ins.observations.length : 0 },
  ]), [t, expensesOn, ins, complaintsPending]);

  const teacherHandovers = data?.role === 'teacher' ? data.pending_handovers : [];

  return (
    <Surface id="screen.teacher.cash-reconcile" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* The notch strip, in the hero's own colours. The list scrolls BELOW it, so the sticky
          segments stop under the status bar instead of sliding beneath the notch with the
          page under the clock (founder 2026-10-04). */}
      <View style={{ height: insets.top, backgroundColor: gradients.auth[0] }} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.pageEnd + insets.bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        {...hold.scrollProps}
      >
        {/* Her band (founder 2026-10-07: «her frame takes the upper section, bigger, like the
            video»): the framed portrait large on navy, her bubble with the greeting and today's
            sheet. The segments under it stay sticky, so switching never means scrolling back up.
            The fallback keeps the child count, so stickyHeaderIndices still points at the segments. */}
        <Surface id="teacher.cash_reconcile.hero" fallback={<View />}>
        <RoseHero
          greeting={ins?.context?.greeting ?? ''}
          sub={ins?.context?.season ?? (data ? t('cash.week_of', { start: formatShortDate(data.week.start), end: formatShortDate(data.week.end) }) : '')}
          sheet={isPast ? null : sheet}
          activity={segment === 'week' ? 'cash' : segment}
          asleep={!isPast && segment === 'week' && !!data && isDeskCalm(data)}
          live={arrived}
          hold={hold}
          onBack={() => router.back()}
          onSettings={data?.role === 'teacher' ? () => setSettingsOpen(true) : undefined}
          onExportAll={() => exportPdf('all', weekParam)}
          exportingAll={exporting === 'all'}
          onExportSheet={() => exportPdf('sheet')}
          exportingSheet={exporting === 'sheet'}
          lines={seasonLines}
        >
          {isPast ? (
            <RoseHeroCard icon="calendar" title={t('cash.viewing_past')} sub={t('cash.back_to_now')} chevron onPress={() => { setPeriod('week'); setWeekOffset(0); setSegment('week'); }} />
          ) : isError && !data ? (
            <RoseHeroCard icon="refresh" title={t('cash.load_failed')} onPress={() => refetch()} />
          ) : null}
        </RoseHero>
        </Surface>

        {/* Segments — sticky, so switching never means scrolling back up. */}
        <Surface id="teacher.cash_reconcile.segments" fallback={<View />}>
        <View style={{ backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSunken, borderRadius: radius.full, padding: 4 }}>
            {segments.map((s) => {
              const on = segment === s.key;
              return (
                <TouchableOpacity key={s.key} onPress={() => setSegment(s.key)} activeOpacity={0.9} accessibilityRole="tab" accessibilityState={{ selected: on }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 40, paddingHorizontal: 4, borderRadius: radius.full, backgroundColor: on ? colors.surface : 'transparent', ...(on ? shadows.sm : {}) }}>
                  {/* Four segments share the strip: only the active one spends width on its icon. */}
                  {on ? <Icon name={s.icon} size={16} color={colors.brand} /> : null}
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.brand : colors.textSecondary, flexShrink: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{s.label}</Text>
                  {s.badge ? (
                    <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{money(s.badge)}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        </Surface>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          {!arrived || isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : !data ? (
            // Nothing saved and no answer: say which, never a spinner that waits for nothing.
            isNetworkFailure(error)
              ? <EmptyState icon="warning" title={t('offline.not_saved_title')} message={t('offline.not_saved_rose', { rose: rose.name })} />
              : <EmptyState icon="refresh" title={t('cash.load_failed')} />
          ) : segment === 'week' ? (
            <View>
              <Surface id="teacher.cash_reconcile.export_pill">
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm }}>
                <ExportPill busy={exporting === 'week' || exporting === 'month'}
                  onPress={() => (period === 'month' ? exportPdf('month', { month: monthKey }) : exportPdf('week', weekParam))} />
              </View>
              </Surface>
              <PeriodBar
                period={period}
                label={period === 'month'
                  ? (monthQ.data?.period.label ?? monthKey)
                  : t('cash.week_of', { start: formatShortDate(data.week.start), end: formatShortDate(data.week.end) })}
                canNext={period === 'month' ? monthOffset > 0 : weekOffset > 0}
                onPeriod={(p) => { setPeriod(p); }}
                onPrev={() => (period === 'month' ? setMonthOffset((o) => o + 1) : setWeekOffset((o) => o + 1))}
                onNext={() => (period === 'month' ? setMonthOffset((o) => Math.max(0, o - 1)) : setWeekOffset((o) => Math.max(0, o - 1)))}
              />
              {period === 'month' ? (
                monthQ.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
                  : monthQ.data ? <MonthView m={monthQ.data} onOpenWeek={(w) => {
                    const diff = Math.round((startOfDay(new Date()).getTime() - startOfDay(new Date(w)).getTime()) / (7 * 86400000));
                    setWeekOffset(Math.max(0, diff)); setPeriod('week');
                  }} />
                  : null
              ) : (
                <>
                  {/* What needs the teacher now — it used to sit inside the hero, which pushed the
                      segments (and the expenses behind them) below the fold (founder 2026-10-03:
                      «I have to scroll down to see my expenses»). The hero is short now; this
                      card opens the week segment instead. */}
                  {!isPast ? (
                    <Surface id="teacher.cash_reconcile.now_card">
                    <View style={{ marginBottom: spacing.md }}>
                      <NowCard data={data} onDone={onDone} onOpenHandovers={() => setHandoverOpen(true)} onCountOwn={() => setSegment('week')} />
                    </View>
                    </Surface>
                  ) : null}
                  {/* «تحصيلات الأسبوع»: who paid what this week, per student, filtered by kind. */}
                  <Surface id="teacher.cash_reconcile.collections_entry">
                  <TouchableOpacity onPress={() => router.push({ pathname: '/(teacher)/cash-collections', params: weekOffset > 0 ? { week: weekDay } : {} } as never)} activeOpacity={0.85} accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="children" size={22} color={colors.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('cash.who_paid_title')}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>{t('cash.collections_entry_sub')}</Text>
                    </View>
                    <Icon name="back" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                  </Surface>
                  <Surface id="teacher.cash_reconcile.week_segment">
                  <WeekSegment data={data} onChanged={invalidate} onOpenHandover={() => setHandoverOpen(true)} freshStamp={freshStamp} />
                  </Surface>
                </>
              )}
            </View>
          ) : segment === 'expenses' ? (
            <Surface id="teacher.cash_reconcile.expenses_panel">
            <ExpensesPanel embedded onExport={(week) => exportPdf('expenses', { week })} exporting={exporting === 'expenses'} />
            </Surface>
          ) : segment === 'complaints' ? (
            <View>
              <Surface id="teacher.cash_reconcile.export_pill">
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm }}>
                <ExportPill busy={exporting === 'complaints'} onPress={() => exportPdf('complaints')} />
              </View>
              </Surface>
              <Surface id="teacher.cash_reconcile.complaints_panel">
              <RoseComplaintsPanel />
              </Surface>
            </View>
          ) : (
            <View>
              <Surface id="teacher.cash_reconcile.export_pill">
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm }}>
                <ExportPill busy={exporting === 'notes'} onPress={() => exportPdf('notes')} />
              </View>
              </Surface>
              {introSeen === false ? (
                <Surface id="teacher.cash_reconcile.notes_intro">
                <View style={{ backgroundColor: colors.accentLight, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md }}>
                  {rose.named ? <RosePortrait size={56} style={{ marginBottom: spacing.xs }} /> : null}
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('cash.intro_line1', { rose: rose.name })}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 22 }}>{t('cash.intro_line2')}</Text>
                  <TouchableOpacity onPress={dismissIntro} style={{ alignSelf: 'flex-start', marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.accent }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('cash.intro_dismiss')}</Text>
                  </TouchableOpacity>
                </View>
                </Surface>
              ) : null}
              <Observations items={ins?.enabled ? ins.observations : []} />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Handovers: the assistant records one; the teacher confirms the pending ones or records a receipt. */}
      <Surface id="teacher.cash_reconcile.handover_sheet">
      <Sheet open={handoverOpen} onClose={() => setHandoverOpen(false)} title={t('cash.handovers')}>
        {handoverOpen ? dialog : null}
        {data?.role === 'teacher' ? (
          <View>
            {teacherHandovers.length > 0 ? (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('cash.handover_pending_title')}</Text>
                {teacherHandovers.map((h) => <HandoverRow key={h.id} h={h} onReview={(x, d) => {
                  if (d === 'confirm') { review.mutate({ id: x.id, d }); return; }
                  // «لم أستلم» keeps the money on the assistant's drawer — she asks first.
                  void ask({
                    title: t('cash.handover_reject_q', { amount: money(x.amount) }),
                    message: t('cash.handover_reject_hint', { name: x.assistant_name ?? '' }),
                    confirm: t('cash.handover_reject'),
                    cancel: t('common.cancel'),
                    danger: true,
                  }).then((ok) => { if (ok) review.mutate({ id: x.id, d }); });
                }} />)}
              </View>
            ) : null}
            {data.assistants.length > 0 ? (
              <View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('cash.handover_received')}</Text>
                <HandoverSheetBody venues={data.venues} perVenue={data.settings.per_venue} assistants={data.assistants} onSaved={onHandover} />
              </View>
            ) : null}
          </View>
        ) : data ? (
          <HandoverSheetBody venues={data.venues} perVenue={data.settings.per_venue} onSaved={onHandover} />
        ) : null}
      </Sheet>
      </Surface>

      <Surface id="teacher.cash_reconcile.settings_sheet">
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t('cash.settings_title')}>
        {data?.role === 'teacher' ? <SettingsBody v={data} onChanged={invalidate} /> : null}
        {/* Her chapter of «شروحات», a tap away from her own settings. */}
        {data?.role === 'teacher' && roseVideo ? (
          <Surface id="teacher.cash_reconcile.rose_tutorial_link">
          <TouchableOpacity onPress={() => { setSettingsOpen(false); router.push('/(teacher)/tutorial/rose' as Href); }} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.accentLight }}>
            <Icon name="play" size={18} color={colors.accent} />
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('tutorials.rose_link')}</Text>
            <Icon name="back" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          </Surface>
        ) : null}
        {/* «منطقة الخطر» (founder 2026-10-19): last in her settings, the teacher's alone. */}
        {data?.role === 'teacher' ? (
          <Surface id="teacher.cash_reconcile.danger_zone">
          <TouchableOpacity onPress={() => { setSettingsOpen(false); router.push('/(teacher)/rose-reset' as Href); }} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.dangerLight }}>
            <Icon name="warning" size={20} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.dangerText }}>{t('rose_reset.entry_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('rose_reset.entry_hint')}</Text>
            </View>
            <Icon name="back" size={16} color={colors.danger} />
          </TouchableOpacity>
          </Surface>
        ) : null}
      </Sheet>
      </Surface>
      <Surface id="teacher.cash_reconcile.stamp_burst">{burstNode}</Surface>
      {handoverOpen ? null : dialog}
    </View>
    </Surface>
  );
}

/** الأسبوع: the drawers, then handovers, then (teacher) the running totals. */
function WeekSegment({ data, onChanged, onOpenHandover, freshStamp }: { data: CashView; onChanged: () => void; onOpenHandover: () => void; freshStamp: number | null }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const isTeacher = data.role === 'teacher';

  const handoverButton = (
    <Surface id="teacher.cash_reconcile.handover_button">
    <TouchableOpacity onPress={onOpenHandover} activeOpacity={0.85}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, borderStyle: 'dashed', marginBottom: spacing.md }}>
      <Icon name="transfer" size={18} color={colors.brand} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{isTeacher ? t('cash.handover_received') : t('cash.handover_add')}</Text>
    </TouchableOpacity>
    </Surface>
  );

  if (data.role === 'assistant') {
    const v: AssistantCashView = data;
    const shown = v.drawers.filter((d) => !v.unanswered.some((u) => u.id === d.id));
    return (
      <View>
        {shown.length === 0 && v.unanswered.length === 0 ? <EmptyState icon="success" title={t('cash.no_prompt')} message={t('cash.no_prompt_hint')} /> : null}
        <Surface id="teacher.cash_reconcile.drawers">
        {shown.map((d) => <DrawerCard key={d.id} d={d} isTeacher={false} onChanged={onChanged} freshStamp={d.id === freshStamp} />)}
        </Surface>
        {v.collections ? <Surface id="teacher.cash_reconcile.collections_list"><CollectionsList events={v.collections} byKind={v.collected_by_kind} own /></Surface> : null}
        {handoverButton}
        <Surface id="teacher.cash_reconcile.handovers_list">
        {v.handovers.map((h) => <HandoverRow key={h.id} h={h} />)}
        </Surface>
      </View>
    );
  }

  const v: TeacherCashView = data;
  const olderGaps = v.open_gaps.filter((g) => g.week_start !== v.week.start);
  return (
    <View>
      {/* The week in three numbers. */}
      <Surface id="teacher.cash_reconcile.week_stats">
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        {[
          { label: t('cash.collected_teacher'), value: money(v.collected_breakdown ? v.collected_breakdown.total : v.collected), tint: colors.textPrimary },
          ...(v.settings.expenses_enabled ? [{ label: t('cash.expenses'), value: money(v.expenses), tint: colors.textPrimary }] : []),
          { label: t('cash.handovers'), value: money(v.handovers_confirmed), tint: colors.textPrimary },
        ].map((c) => (
          <View key={c.label} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: c.tint }}>{c.value}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{c.label}</Text>
          </View>
        ))}
      </View>
      </Surface>
      <OpeningBoard v={v} onChanged={onChanged} />
      {/* Where the week's money sits — the base of every drawer's equation, from the collection ledger. */}
      {v.collected_breakdown ? (
        <Surface id="teacher.cash_reconcile.collected_split_note">
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: -spacing.xs, marginBottom: spacing.md }}>
          {t('cash.collected_split', { assistants: money(v.collected_breakdown.cash_by_assistants), teacher: money(v.collected_breakdown.cash_by_teacher) })}
          {v.collected_breakdown.digital > 0 ? ` · ${t('cash.collected_digital', { amount: money(v.collected_breakdown.digital) })}` : ''}
          {v.collected_breakdown.unattributed > 0 ? ` · ${t('cash.collected_unattributed', { amount: money(v.collected_breakdown.unattributed) })}` : ''}
        </Text>
        </Surface>
      ) : null}
      {v.registry_now ? <Surface id="teacher.cash_reconcile.registry_now_card"><RegistryNowCard r={v.registry_now} byKind={v.collected_breakdown?.by_kind} /></Surface> : null}

      <Surface id="teacher.cash_reconcile.drawers">
      {v.drawers.length === 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' }}>{t('cash.no_assistants')}</Text>
      ) : (
        v.drawers.map((d) => d.is_teacher_drawer && d.registry === null && !d.closed_at
          // The teacher counts their OWN drawer in place — the same card an assistant answers.
          ? <PromptCard key={d.id} row={d} onDone={() => onChanged()} onOpeningSaved={onChanged} />
          : <DrawerCard key={d.id} d={d} name={d.name} isTeacher onChanged={onChanged} freshStamp={d.id === freshStamp} />)
      )}
      </Surface>

      {v.collections ? <Surface id="teacher.cash_reconcile.collections_list"><CollectionsList events={v.collections} byKind={v.collected_breakdown?.by_kind} own={false} /></Surface> : null}

      {handoverButton}
      <Surface id="teacher.cash_reconcile.handovers_list">
      {v.week_handovers.map((h) => <HandoverRow key={h.id} h={h} />)}
      </Surface>

      {olderGaps.length > 0 ? (
        <Surface id="teacher.cash_reconcile.open_gaps">
        <View style={{ marginTop: spacing.md }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('cash.open_gaps_title')}</Text>
          {olderGaps.map((g) => <DrawerCard key={g.id} d={g} name={g.name} isTeacher onChanged={onChanged} />)}
        </View>
        </Surface>
      ) : null}

      {v.running_totals.length > 0 ? (
        <Surface id="teacher.cash_reconcile.running_totals">
        <View style={{ backgroundColor: colors.warning + '14', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.warning, padding: spacing.lg, marginTop: spacing.md }}>
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
        </Surface>
      ) : null}
    </View>
  );
}
