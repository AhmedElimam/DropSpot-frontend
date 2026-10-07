import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { formatShortDate, formatDate, formatDateTime, formatNumber, relativeDay } from '@/utils/format';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SheetModal } from '@/components/ui/SheetModal';
import { RoseStamp, RosePortrait } from '@/components/rose/RoseStamp';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { useRose } from '@/hooks/useRose';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { getExpenses, addExpense, deleteExpense, assignExpenseVenue, suggestCategory, type Expense, type VenueRef, type ExpenseTrace, type RecurringSuggestion } from '@/api/cash';

/**
 * The expense ledger (spec 2026-09-25 §6, minimum §11.1). Fastest path from "I just bought
 * coffee" to logged: amount, one tap on a category, done. Every entry is attributed to
 * whoever typed it and stamped with when — the server marks an entry LATE when its week
 * (Friday→Thursday) had already closed, and shows both dates.
 *
 * Layout (founder 2026-10-07: «the inputs take a huge chunk of the page, people cannot see
 * the expenses down and get confused that the page has a bottom section»): the LIST is the
 * page. The week's total and one «سجّل مصروف» button sit at the top; the form itself lives
 * in a sheet that slides up over the list and closes when the entry is saved. The quick-add
 * chips (her memory of what this person logs) stay on the page — one tap prefills the sheet.
 *
 * An assistant sees only what they logged themselves (server-enforced); the teacher sees
 * everything, each row naming who logged it. An entry the teacher accepted in the weekly
 * review carries her small navy stamp — it is in her book.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_TINT = (): Record<string, string> => ({ pending: colors.textTertiary, accepted: colors.success, questioned: colors.warning, rejected: colors.danger });
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const money = (v: number) => formatNumber(v, { maximumFractionDigits: 2 });

/** Each category has its own picture and colour, so a glance tells coffee from rent. */
const CAT = (): Record<string, { glyph: string; tint: string }> => ({
  coffee: { glyph: '☕', tint: colors.warning },
  breakfast: { glyph: '🥪', tint: colors.accent },
  bills: { glyph: '🧾', tint: colors.info },
  transport: { glyph: '🚕', tint: colors.warningDark },
  supplies: { glyph: '✏️', tint: colors.brand },
  printing: { glyph: '🖨️', tint: colors.brand },
  rent: { glyph: '🏠', tint: colors.success },
  other: { glyph: '📦', tint: colors.textTertiary },
});
const catOf = (key: string) => CAT()[key] ?? CAT().other;

/** A small rounded tag under a row: state, conversation, place. */
function Tag({ icon, text, tint, onPress }: { icon?: 'tickets' | 'location' | 'warning' | 'clock'; text: string; tint: string; onPress?: () => void }) {
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} activeOpacity={0.8} hitSlop={4}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: tint + '1A' }}>
      {icon ? <Icon name={icon} size={12} color={tint} /> : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: tint }} numberOfLines={1}>{text}</Text>
    </TouchableOpacity>
  );
}

/**
 * One expense, one clear line (founder 2026-10-07: «the positioning of texts is messy and
 * confusing»): the category's picture · what it was (category, then the note) · the amount
 * on the far side. Who logged it and «late» sit small under the name; the review state, the
 * conversation, the place and delete live on a tag line underneath — only when there is one.
 */
const ExpenseRow = memo(function ExpenseRow({ e, showLogger, canDelete, perVenue, canAssign, onDelete, onAssign, first }: { e: Expense; showLogger: boolean; canDelete: boolean; perVenue: boolean; canAssign: boolean; onDelete: (e: Expense) => void; onAssign: (e: Expense) => void; first: boolean }) {
  const { t } = useTranslation();
  const cat = catOf(String(e.category));
  const venueLabel = !perVenue ? null : e.venue_kind === 'venue' ? e.venue?.name : e.venue_kind === 'general' ? t('expenses.general') : t('expenses.unassigned');
  const meta = [
    showLogger && !e.logged_by.is_me ? t('expenses.logged_by', { name: e.logged_by.name }) : null,
    e.is_late && e.logged_at ? t('expenses.logged_on', { when: formatDateTime(e.logged_at) }) : null,
  ].filter(Boolean).join(' · ');
  const state = e.review_status && e.review_status !== 'accepted' ? e.review_status : null;
  const hasTags = !!state || e.messages_count > 0 || e.review_status === 'questioned' || !!venueLabel || canDelete || e.is_late;

  return (
    <View style={{ paddingVertical: spacing.md, borderTopWidth: first ? 0 : 1, borderTopColor: colors.borderLight }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: cat.tint + '1F', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20 }}>{cat.glyph}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{e.category_label}</Text>
          {e.note ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 1 }} numberOfLines={2}>{e.note}</Text> : null}
          {meta ? <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 2 }} numberOfLines={1}>{meta}</Text> : null}
        </View>
        {/* The amount, always on the far side, the same place in every row. */}
        <View style={{ alignItems: 'flex-end', minWidth: 64 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{money(e.amount)}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{t('insights.egp')}</Text>
        </View>
        {/* Accepted in the weekly review: in her book. */}
        {e.review_status === 'accepted' ? <RoseStamp ink="navy" size={34} /> : null}
      </View>

      {hasTags ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm, paddingStart: 42 + spacing.md }}>
          {e.is_late ? <Tag icon="clock" text={t('expenses.late')} tint={colors.warningDark} /> : null}
          {state ? <Tag text={t(`review.state_${state}`)} tint={REVIEW_TINT()[state]} /> : null}
          {e.messages_count > 0 || e.review_status === 'questioned' ? (
            <Tag icon="tickets" text={t('review.thread', { count: e.messages_count })} tint={colors.brand}
              onPress={() => router.push({ pathname: '/(teacher)/expense-thread', params: { id: String(e.id) } } as Href)} />
          ) : null}
          {venueLabel ? (
            <Tag icon="location" text={`${venueLabel}${canAssign ? ` · ${t('expenses.assign_venue')}` : ''}`} tint={e.venue_kind === 'unassigned' ? colors.warningDark : colors.textSecondary}
              onPress={canAssign ? () => onAssign(e) : undefined} />
          ) : null}
          {canDelete ? (
            <TouchableOpacity onPress={() => onDelete(e)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('expenses.delete')}
              style={{ marginStart: 'auto', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSunken }}>
              <Icon name="trash" size={15} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {state === 'rejected' && e.reject_reason_label ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.danger, marginTop: 4, paddingStart: 42 + spacing.md }}>{e.reject_reason_label}{e.reject_note ? ` — ${e.reject_note}` : ''}</Text>
      ) : null}
    </View>
  );
});

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brand + '18' : colors.surface }}>
      <Text style={{ fontFamily: on ? fonts.bold : fonts.regular, fontSize: 13, color: on ? colors.brand : colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}

const FieldLabel = ({ children }: { children: string }) => (
  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{children}</Text>
);

/**
 * The expense ledger as a PANEL: embedded inside مدام روز's hub (no header, no keyboard
 * wrapper — the hub provides both) or standalone on the /expenses route, which deep
 * links and observation traces still open.
 */
export function ExpensesPanel({ embedded = false, initialTrace = null }: { embedded?: boolean; initialTrace?: ExpenseTrace | null }) {
  const { t } = useTranslation();
  const rose = useRose();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { isAssistant } = useActiveAbilities();

  // Which week is on screen: any day inside it. Today = the current week.
  const [weekDay, setWeekDay] = useState<Date>(() => new Date());
  const weekKey = ymd(weekDay);
  const isCurrentWeek = useMemo(() => sameCashWeek(new Date(), weekDay), [weekDay]);

  // An observation's trace (v2 §6): arrive with ?from&to[&category][&venue] and list exactly
  // the entries behind the remark until the person goes back to the week view.
  const [trace, setTrace] = useState<ExpenseTrace | null>(initialTrace);
  const { data, isLoading, refetch } = useQuery({ queryKey: ['expenses', weekKey, trace], queryFn: () => getExpenses(weekKey, undefined, trace) });
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  // The composer — a sheet over the list, so the list is never pushed below the fold.
  const [composerOpen, setComposerOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('coffee');
  const [note, setNote] = useState('');
  const [dayChoice, setDayChoice] = useState<'today' | 'yesterday'>('today');
  // Per-venue: a venue id, 'general', or null (not chosen yet). Seeded from the server's
  // default (today's most recent session venue) once the week loads — still editable.
  const [venueChoice, setVenueChoice] = useState<number | 'general' | null>(null);
  const [venueSeeded, setVenueSeeded] = useState(false);
  if (data && !venueSeeded) {
    setVenueSeeded(true);
    if (data.settings.per_venue) setVenueChoice(data.default_venue_id ?? null);
  }
  const perVenue = !!data?.settings.per_venue;
  const enabled = data?.settings.expenses_enabled !== false;

  const expenseDate = useMemo(() => {
    if (!data) return undefined;
    if (isCurrentWeek) {
      const d = new Date();
      if (dayChoice === 'yesterday') d.setTime(d.getTime() - DAY_MS);
      return ymd(d);
    }
    // A past week: the entry belongs to that week's last day and will be marked late.
    return data.week.end;
  }, [data, isCurrentWeek, dayChoice]);

  // Category from the note (v2 §5): she suggests, one tap changes it. A category the person
  // picked by hand is never overridden.
  const categoryTouched = useRef(false);
  const [suggested, setSuggested] = useState<string | null>(null);
  useEffect(() => {
    const note0 = note.trim();
    if (note0.length < 2) { setSuggested(null); return; }
    const h = setTimeout(() => {
      suggestCategory(note0).then((r) => {
        setSuggested(r.category);
        if (r.category && !categoryTouched.current) setCategory(r.category);
      }).catch(() => {});
    }, 350);
    return () => clearTimeout(h);
  }, [note]);

  const openComposer = (prefill?: { amount: number; category: string; note?: string | null }) => {
    if (prefill) {
      setAmount(String(prefill.amount));
      categoryTouched.current = true;
      setCategory(prefill.category);
      setNote(prefill.note ?? '');
    }
    setComposerOpen(true);
  };
  const closeComposer = () => setComposerOpen(false);

  const logRecurring = useMutation({
    mutationFn: (r: RecurringSuggestion) => addExpense({
      amount: r.prefill.amount, category: r.prefill.category, note: r.prefill.note ?? undefined,
      ...(perVenue ? (venueChoice === 'general' || venueChoice === null ? { is_general: true } : { teacher_location_id: venueChoice }) : {}),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['cash-reconciliation'] }); qc.invalidateQueries({ queryKey: ['cash-insights'] }); },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  // She asks; the person confirms. The tap is the decision (v2 Part A §1).
  const confirmRecurring = (r: RecurringSuggestion) => {
    Alert.alert(t('expenses.recurring_confirm_title'), t('expenses.recurring_confirm_hint', { amount: money(r.prefill.amount), category: data?.categories.find((c) => c.key === r.prefill.category)?.label ?? r.prefill.category }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('expenses.recurring_log'), onPress: () => logRecurring.mutate(r) },
    ]);
  };

  const add = useMutation({
    mutationFn: () => addExpense({
      amount: Number(amount), category, note: note.trim() || undefined, expense_date: expenseDate,
      ...(perVenue ? (venueChoice === 'general' ? { is_general: true } : { teacher_location_id: venueChoice as number | null }) : {}),
    }),
    onSuccess: () => {
      setAmount(''); setNote(''); categoryTouched.current = false;
      setComposerOpen(false);
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['cash-reconciliation'] });
    },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['cash-reconciliation'] });
    },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });

  const assign = useMutation({
    mutationFn: ({ id, venue }: { id: number; venue: number | 'general' | null }) =>
      assignExpenseVenue(id, venue === 'general' ? { teacher_location_id: null, is_general: true } : { teacher_location_id: venue, is_general: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['cash-reconciliation'] }); },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  const venues: VenueRef[] = data?.venues ?? [];
  const pickVenue = useCallback((e: Expense) => {
    Alert.alert(t('expenses.assign_venue_title'), `${money(e.amount)} ${t('insights.egp')} · ${e.category_label}`, [
      ...venues.map((v) => ({ text: v.name ?? '', onPress: () => assign.mutate({ id: e.id, venue: v.id }) })),
      { text: t('expenses.general'), onPress: () => assign.mutate({ id: e.id, venue: 'general' }) },
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }, [t, venues, assign]);

  const confirmDelete = useCallback((e: Expense) => {
    Alert.alert(t('expenses.delete_confirm_title'), t('expenses.delete_confirm_hint', { amount: money(e.amount), category: e.category_label }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('expenses.delete'), style: 'destructive', onPress: () => remove.mutate(e.id) },
    ]);
  }, [t, remove]);

  const amountNum = Number(amount);
  const canAdd = !!data && enabled && Number.isFinite(amountNum) && amountNum > 0 && !add.isPending && (!perVenue || venueChoice !== null);
  const items = data?.items ?? [];
  const egp = t('insights.egp');

  // The week's entries by day, newest day first — each day a heading with its own total.
  const days = useMemo(() => {
    const m = new Map<string, Expense[]>();
    for (const e of items) {
      const k = e.expense_date.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return [...m.entries()].sort((x, y) => (x[0] < y[0] ? 1 : -1)).map(([day, rows]) => ({ day, rows, total: rows.reduce((n, e) => n + e.amount, 0) }));
  }, [items]);
  const dayTitle = (day: string) => relativeDay(`${day}T12:00:00`) ?? formatDate(`${day}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' });

  const arrow = (icon: 'forward' | 'back', onPress: () => void, disabled: boolean, label: string) => (
    <TouchableOpacity onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}>
      <Icon name={icon} size={18} color={colors.brand} />
    </TouchableOpacity>
  );

  const content = (
    <>
        {/* The summary: which week, its total, and the one button. */}
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm }}>
          {trace ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('expenses.trace_title')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{formatShortDate(trace.from)} – {formatShortDate(trace.to)}{trace.category ? ` · ${data?.categories.find((c) => c.key === trace.category)?.label ?? ''}` : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => setTrace(null)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.brand }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('expenses.trace_clear')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // RTL: the previous week is on the right («forward» ›), the next on the left.
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {arrow('forward', () => setWeekDay((d) => new Date(d.getTime() - 7 * DAY_MS)), false, t('expenses.prev_week'))}
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{isCurrentWeek ? t('expenses.this_week') : t('expenses.past_week')}</Text>
                {data ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{t('expenses.week_label', { start: formatShortDate(data.week.start), end: formatShortDate(data.week.end) })}</Text> : null}
              </View>
              {arrow('back', () => setWeekDay((d) => new Date(d.getTime() + 7 * DAY_MS)), isCurrentWeek, t('expenses.next_week'))}
            </View>
          )}

          <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md }} />

          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, textAlign: 'center' }}>{t('expenses.total_label')}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 30, color: colors.textPrimary, textAlign: 'center', marginTop: 2 }}>
            {money(data?.total ?? 0)}<Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary }}> {egp}</Text>
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, textAlign: 'center', marginTop: 2 }}>
            {data?.own_only ? t('expenses.own_only_hint') : t('expenses.count', { count: formatNumber(items.length) })}
          </Text>

          {!enabled ? (
            <View style={{ backgroundColor: colors.warning + '14', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.warning, padding: spacing.md, marginTop: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary, textAlign: 'center' }}>{t('expenses.disabled_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2, textAlign: 'center' }}>{t('expenses.disabled_hint')}</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={() => openComposer()} activeOpacity={0.85} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.lg, backgroundColor: colors.brand, marginTop: spacing.md }}>
              <Icon name="add" size={19} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('expenses.compose')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quick add — what this person logs often; one tap opens the sheet filled in. */}
        {enabled && (data?.quick_add.length ?? 0) > 0 ? (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('expenses.quick_add_title')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {(data?.quick_add ?? []).map((q) => (
                <TouchableOpacity key={`${q.category}:${q.amount}`} activeOpacity={0.85} accessibilityRole="button"
                  onPress={() => openComposer({ amount: q.amount, category: q.category, note: q.note })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingStart: 8, paddingEnd: 12, paddingVertical: 6, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                  <Text style={{ fontSize: 16 }}>{catOf(q.category).glyph}</Text>
                  <View>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>{q.note ?? q.label}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary }}>{money(q.amount)} {egp}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {/* What she remembers is due — her suggestion, the person's tap. */}
        {(data?.recurring.length ?? 0) > 0 && enabled ? (
          <View style={{ backgroundColor: colors.brand + '0F', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.brand + '33', padding: spacing.md, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
              {rose.named ? <RosePortrait size={30} nod={false} /> : <Icon name="note" size={16} color={colors.brand} />}
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }}>{t('expenses.recurring_title', { rose: rose.name })}</Text>
            </View>
            {(data?.recurring ?? []).map((r, i) => (
              <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm, marginTop: i === 0 ? 0 : spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.brand + '22' }}>
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, lineHeight: 22 }}>{r.text}</Text>
                <TouchableOpacity onPress={() => confirmRecurring(r)} disabled={logRecurring.isPending} style={{ paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.brand }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('expenses.recurring_log')}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {perVenue && (data?.unassigned_count ?? 0) > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warning + '14', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg }}>
            <Icon name="location" size={16} color={colors.warningDark} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.warningDark }}>{t('expenses.unassigned_hint', { count: data?.unassigned_count })}</Text>
          </View>
        ) : null}

        {/* The entries, by day. */}
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : items.length === 0 ? (
          <EmptyState icon="money" title={t('expenses.none')} message={t('expenses.none_hint', { rose: rose.name })} />
        ) : (
          days.map(({ day, rows, total }) => (
            <View key={day} style={{ marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, paddingHorizontal: spacing.xs }}>
                <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{dayTitle(day)}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{money(total)} {egp}</Text>
              </View>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, ...shadows.sm }}>
                {rows.map((e, i) => (
                  <ExpenseRow key={e.id} e={e} first={i === 0} showLogger={!isAssistant} canDelete={e.logged_by.is_me && !e.locked && (!isAssistant || e.review_status === 'pending')} perVenue={perVenue} canAssign={!isAssistant} onDelete={confirmDelete} onAssign={pickVenue} />
                ))}
              </View>
            </View>
          ))
        )}
    </>
  );

  // The form: amount, one tap on a category, the rest optional. Over the list, gone when saved.
  const composer = (
    <SheetModal visible={composerOpen} onClose={closeComposer} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.xl, paddingBottom: spacing.xl + insets.bottom, maxHeight: '90%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('expenses.add_title')}</Text>
        <TouchableOpacity onPress={closeComposer} hitSlop={8}><Icon name="close" size={22} color={colors.textTertiary} /></TouchableOpacity>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <FieldLabel>{t('expenses.amount')}</FieldLabel>
        <TextInput
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          autoFocus
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={t('expenses.amount')}
          style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'center', marginBottom: spacing.md, backgroundColor: colors.surfaceSunken }}
        />
        <FieldLabel>{t('expenses.category')}</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
          {(data?.categories ?? []).map((c) => {
            const on = c.key === category;
            return <Chip key={c.key} on={on} onPress={() => { categoryTouched.current = true; setCategory(c.key); }} label={`${catOf(c.key).glyph} ${c.label}${suggested === c.key && on && !categoryTouched.current ? ` · ${t('expenses.category_suggested', { rose: rose.name })}` : ''}`} />;
          })}
        </View>
        {perVenue ? (
          <>
            <FieldLabel>{t('expenses.venue')}</FieldLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
              {[...venues.map((v) => ({ key: v.id as number | 'general', label: v.name ?? '' })), { key: 'general' as const, label: t('expenses.general') }].map((c) => (
                <Chip key={String(c.key)} on={venueChoice === c.key} label={c.label} onPress={() => setVenueChoice(c.key)} />
              ))}
            </View>
            {venueChoice === null ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark, marginBottom: spacing.sm }}>{t('expenses.venue_required')}</Text> : null}
          </>
        ) : null}
        <FieldLabel>{t('expenses.note')}</FieldLabel>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('expenses.note_placeholder')}
          placeholderTextColor={colors.textTertiary}
          maxLength={500}
          style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'right', marginBottom: spacing.md }}
        />
        {isCurrentWeek ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
            {(['today', 'yesterday'] as const).map((k) => <Chip key={k} on={dayChoice === k} label={t(`expenses.${k}`)} onPress={() => setDayChoice(k)} />)}
          </View>
        ) : data ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark, marginBottom: spacing.md }}>{t('expenses.past_week_date', { date: formatShortDate(data.week.end) })}</Text>
        ) : null}
        <Button title={t('expenses.add')} onPress={() => add.mutate()} disabled={!canAdd} loading={add.isPending} />
      </ScrollView>
    </SheetModal>
  );

  // Embedded in مدام روز's hub the OUTER screen scrolls and pulls to refresh; nesting a
  // second vertical ScrollView would fight it, so the panel is a plain View there.
  if (embedded) return <View style={{ paddingBottom: spacing.md }}>{content}{composer}</View>;

  const body = (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: nav.pageEnd + insets.bottom + spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('expenses.title')}</Text>
      </View>
      {body}
      {composer}
    </KeyboardAvoidingView>
  );
}

/** Same Friday→Thursday week? (Local time; the server is the authority — this only drives the "this week" label.) */
function sameCashWeek(a: Date, b: Date): boolean {
  const start = (d: Date) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const back = (x.getDay() - 5 + 7) % 7; // days since Friday
    x.setDate(x.getDate() - back);
    return x.getTime();
  };
  return start(a) === start(b);
}
