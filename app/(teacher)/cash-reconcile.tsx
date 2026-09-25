import { memo, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView, Switch, Modal } from 'react-native';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import type { CollectionEvent, KindTotals, RegistryNow } from '@/api/cash';
import { formatShortDate, formatDateTime, formatNumber } from '@/utils/format';
import { colors, spacing, radius, nav, shadows, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ExpensesPanel } from '@/components/cash/ExpensesPanel';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getFriendlyErrorMessage } from '@/utils/errors';
import {
  getCashReconciliation, respondReconciliation, setOpeningBalance, recordHandover, reviewHandover, updateCashSettings, getCashInsights,
  type AssistantCashView, type TeacherCashView, type Drawer, type TeacherDrawer, type Handover, type ReconciliationResult, type ReconciliationStatus, type VenueRef, type Observation, type CashView,
} from '@/api/cash';

/**
 * مدام روز — مديرة الحسابات. ONE screen, no hopping:
 *
 *   hero      her greeting, the week, a gear for settings
 *   now       the single thing that needs this person right now — the assistant's count
 *             (answered right here), or the teacher's confirmations and reviews
 *   segments  الأسبوع · المصاريف · ملاحظاتها — everything else, in place
 *   sheets    handover and settings slide up over the screen instead of leaving it
 *
 * The maths, the voice rules and who-sees-what are unchanged: the server decides the
 * shape (`role`), figures are computed there, and an assistant's payload carries only
 * their own drawers. This file is only how it looks and how few taps it takes.
 */

const money = (v: number) => formatNumber(v, { maximumFractionDigits: 2 });
const INTRO_KEY = 'cash_intro_seen_v1';
type Segment = 'week' | 'expenses' | 'notes';

const RESULT_TINT: Record<ReconciliationResult, string> = {
  deficit: colors.danger, balanced: colors.success, surplus: colors.warning, unknown: colors.textTertiary,
};
const STATUS_TINT: Record<ReconciliationStatus, string> = {
  confirmed: colors.success, discrepancy: colors.danger, pending: colors.warning, not_reconciled: colors.warning, awaiting_opening: colors.textTertiary,
};
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
    return <Pill tint={RESULT_TINT[d.result]} text={`${t(`cash.${d.result}`)}${d.difference !== null && d.result !== 'balanced' ? ` ${money(Math.abs(d.difference))}` : ''}`} />;
  }
  return <Pill tint={STATUS_TINT[d.status]} text={t(`cash.${d.status}`)} />;
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
      {d.handovers > 0 ? <Figure label={t('cash.handovers')} value={`− ${money(d.handovers)} ${egp}`} /> : null}
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

function Details({ d, extra }: { d: Drawer; extra?: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
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
  );
}

// ───────────────────────── the assistant's count, answered in place ─────────────────────────

function PromptCard({ row, onDone }: { row: Drawer; onDone: (d: Drawer) => void }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const [mode, setMode] = useState<'ask' | 'diff'>(row.expected === null ? 'diff' : 'ask');
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
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadows.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="money" size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('cash.banner_pending')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('cash.week_of', { start: formatShortDate(row.week_start), end: formatShortDate(row.week_end) })}{row.venue?.name ? ` · ${row.venue.name}` : ''}</Text>
        </View>
      </View>

      <BigPair
        left={{ label: t('cash.collected'), value: money(row.collected) }}
        right={{ label: t('cash.expected'), value: row.expected !== null ? money(row.expected) : '—', tint: row.expected !== null ? colors.brand : colors.warningDark }}
      />
      {row.expected === null ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark, marginBottom: spacing.sm }}>
          {row.opening_reason === 'previous_unreconciled' ? t('cash.opening_prev_unreconciled') : t('cash.opening_first_week')}
        </Text>
      ) : null}

      {mode === 'ask' ? (
        <>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center', marginVertical: spacing.sm }}>{t('cash.question')}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}><Button title={t('cash.yes_full')} variant="success" onPress={() => respond.mutate({ full: true })} loading={respond.isPending} /></View>
            <View style={{ flex: 1 }}><Button title={t('cash.no_diff')} variant="outline" onPress={() => setMode('diff')} disabled={respond.isPending} /></View>
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
          <Button title={t('cash.submit')} onPress={() => respond.mutate({ full: false, registry: registryNum, reason: reason.trim() || undefined })}
            disabled={registry === '' || !Number.isFinite(registryNum) || needsReason} loading={respond.isPending} />
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

// ───────────────────────── drawers ─────────────────────────

function OpeningEntry({ d, onSaved }: { d: Drawer; onSaved: () => void }) {
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

/** One drawer, light: who · where, the two figures, the verdict, one button. */
function DrawerCard({ d, name, isTeacher, onChanged }: { d: Drawer | TeacherDrawer; name?: string; isTeacher: boolean; onChanged: () => void }) {
  const { t } = useTranslation();
  const answered = d.registry !== null;
  const tint = d.result && d.result !== 'unknown' && answered ? RESULT_TINT[d.result] : colors.border;
  const reviewWaiting = d.review_pending ?? 0;
  const openReview = () => router.push({ pathname: '/(teacher)/cash-review', params: { id: String(d.id) } } as Href);

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: tint, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{[name, d.venue?.name].filter(Boolean).join(' · ') || t('cash.week_of', { start: formatShortDate(d.week_start), end: formatShortDate(d.week_end) })}</Text>
          {name ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('cash.week_of', { start: formatShortDate(d.week_start), end: formatShortDate(d.week_end) })}</Text> : null}
        </View>
        <ResultPill d={d} />
      </View>
      <BigPair
        left={d.expected !== null
          ? { label: t('cash.expected'), value: money(d.expected), tint: colors.brand }
          : { label: t('cash.net_movement'), value: `${(d.net_movement ?? 0) > 0 ? '+' : ''}${money(d.net_movement ?? 0)}`, tint: colors.warningDark }}
        right={{ label: t('cash.actual'), value: answered ? money(d.actual ?? d.registry ?? 0) : '—', tint: answered && d.result && d.result !== 'unknown' ? RESULT_TINT[d.result] : undefined }}
      />
      <SurplusNotice d={d} />
      <Details d={d} extra={isTeacher && d.opening_balance === null && !d.closed_at ? <OpeningEntry d={d} onSaved={onChanged} /> : null} />
      {isTeacher ? (
        <TouchableOpacity onPress={openReview} activeOpacity={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, marginTop: spacing.sm, backgroundColor: reviewWaiting > 0 ? colors.brand : colors.surfaceSunken }}>
          <Icon name={d.closed_at ? 'lock' : 'eye'} size={16} color={reviewWaiting > 0 ? '#fff' : colors.brand} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: reviewWaiting > 0 ? '#fff' : colors.brand }}>
            {d.closed_at ? t('review.closed') : reviewWaiting > 0 ? t('review.waiting', { count: money(reviewWaiting) }) : t('review.open')}
          </Text>
        </TouchableOpacity>
      ) : answered ? (
        <TouchableOpacity onPress={openReview} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
          <Icon name="eye" size={15} color={colors.brand} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('review.title')}</Text>
        </TouchableOpacity>
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
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{money(h.amount)} {t('insights.egp')}{h.assistant_name ? ` · ${h.assistant_name}` : ''}</Text>
        <Pill tint={tint} text={t(`cash.handover_${h.status}`)} />
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
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: SHEET_BACKDROP, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: spacing.xl + insets.bottom, maxHeight: '88%' }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Icon name="close" size={22} color={colors.textTertiary} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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

function SettingsBody({ v, onChanged }: { v: TeacherCashView; onChanged: () => void }) {
  const { t } = useTranslation();
  const [tol, setTol] = useState(String(v.settings.tolerance));
  const [bulkMax, setBulkMax] = useState(String(v.settings.review_bulk_max ?? 500));
  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateCashSettings>[0]) => updateCashSettings(patch),
    onSuccess: onChanged,
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
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
      <View style={row}>{label(t('cash.setting_expenses'), t('cash.setting_expenses_hint'))}<Switch value={v.settings.expenses_enabled} onValueChange={(on) => save.mutate({ expenses_enabled: on })} disabled={save.isPending} /></View>
      <View style={row}>{label(t('cash.setting_per_venue'), t('cash.setting_per_venue_hint'))}<Switch value={v.settings.per_venue} onValueChange={(on) => save.mutate({ expenses_per_venue: on })} disabled={save.isPending || v.venues.length === 0} /></View>
      {v.settings.expenses_enabled ? (
        <View style={row}>{label(t('cash.setting_reminder'), t('cash.setting_reminder_hint'))}<Switch value={v.settings.expense_reminder_enabled !== false} onValueChange={(on) => save.mutate({ expense_reminder_enabled: on })} disabled={save.isPending} /></View>
      ) : null}
      <View style={row}>{label(t('cash.setting_insights'), t('cash.setting_insights_hint'))}<Switch value={v.settings.insights_enabled !== false} onValueChange={(on) => save.mutate({ insights_enabled: on })} disabled={save.isPending} /></View>
      {v.settings.insights_enabled !== false ? (
        <View style={row}>{label(t('cash.setting_insight_pushes'))}
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
      <View style={row}>{label(t('review.setting_bulk_max'), t('review.setting_bulk_max_hint'))}{numeric(bulkMax, setBulkMax, () => { const n = Number(bulkMax); if (Number.isFinite(n) && n !== (v.settings.review_bulk_max ?? 500)) save.mutate({ review_bulk_max: n }); })}</View>
      <View style={[row, { borderBottomWidth: 0 }]}>{label(t('cash.setting_tolerance'))}{numeric(tol, setTol, () => { const n = Number(tol); if (Number.isFinite(n) && n !== v.settings.tolerance) save.mutate({ cash_tolerance: n }); })}</View>
    </View>
  );
}

function Observations({ items }: { items: Observation[] }) {
  const { t } = useTranslation();
  const open = (o: Observation) => router.push({ pathname: '/(teacher)/expenses', params: { from: o.trace.from, to: o.trace.to, ...(o.trace.category ? { category: o.trace.category } : {}), ...(o.trace.venue !== undefined ? { venue: String(o.trace.venue) } : {}) } } as Href);
  if (items.length === 0) return <EmptyState icon="info" title={t('cash.notes_none')} message={t('cash.notes_none_hint')} />;
  return (
    <View>
      {items.map((o) => (
        <TouchableOpacity key={o.key} onPress={() => open(o)} activeOpacity={0.85}
          style={{ backgroundColor: o.type === 'streak' ? colors.success + '14' : colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: o.type === 'streak' ? colors.success : colors.border, padding: spacing.lg, marginBottom: spacing.sm, ...shadows.sm }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, lineHeight: 24 }}>{o.text}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <Icon name="search" size={13} color={colors.brand} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('cash.observation_open')}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ───────────────────────── the screen ─────────────────────────

/** The single thing that needs this person right now. */
function NowCard({ data, onDone, onOpenHandovers }: { data: CashView; onDone: (d: Drawer) => void; onOpenHandovers: () => void }) {
  const { t } = useTranslation();
  if (data.role === 'assistant') {
    const row = data.unanswered[0];
    if (row) {
      return (
        <View>
          {row.week_start !== data.week.start ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: '#fff', opacity: 0.85, marginBottom: spacing.sm }}>{t('cash.late_answer_hint')}</Text> : null}
          <PromptCard row={row} onDone={onDone} />
        </View>
      );
    }
    return <Calm text={t('cash.calm_assistant')} />;
  }
  const handovers = data.pending_handovers.length;
  const waiting = data.drawers.filter((d) => (d.review_pending ?? 0) > 0 || (!d.closed_at && d.registry !== null));
  const first = waiting[0];
  if (handovers === 0 && !first) return <Calm text={t('cash.calm_teacher')} />;
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadows.md }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('cash.now_title')}</Text>
      {handovers > 0 ? (
        <TouchableOpacity onPress={onOpenHandovers} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.warning + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name="transfer" size={20} color={colors.warning} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('cash.now_handovers', { count: money(handovers) })}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('cash.handover_pending_hint')}</Text>
          </View>
          <Icon name="back" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      ) : null}
      {first ? (
        <TouchableOpacity onPress={() => router.push({ pathname: '/(teacher)/cash-review', params: { id: String(first.id) } } as Href)} activeOpacity={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: handovers > 0 ? 1 : 0, borderTopColor: colors.borderLight }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brand + '18', alignItems: 'center', justifyContent: 'center' }}><Icon name="eye" size={20} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('cash.now_review', { name: first.name, count: money(waiting.length) })}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{(first.review_pending ?? 0) > 0 ? t('review.waiting', { count: money(first.review_pending ?? 0) }) : t('cash.now_review_hint')}</Text>
          </View>
          <Icon name="back" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Calm({ text }: { text: string }) {
  return (
    <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Icon name="success" size={22} color="#fff" />
      <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{text}</Text>
    </View>
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
    qc.invalidateQueries({ queryKey: ['cash-insights'] });
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['teacher-insights'] });
  };
  const review = useMutation({
    mutationFn: ({ id, d }: { id: number; d: 'confirm' | 'reject' }) => reviewHandover(id, d),
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  const onDone = (d: Drawer) => {
    invalidate();
    if (d.status === 'confirmed') Alert.alert(t('cash.balanced_persona'));
    else if (d.status === 'awaiting_opening') Alert.alert(t('cash.awaiting_opening'));
    else if (d.result === 'surplus') Alert.alert(t('cash.surplus_plain', { amount: money(Math.abs(d.difference ?? 0)) }), t('cash.surplus_question'));
    else Alert.alert(t('cash.deficit_plain', { amount: money(Math.abs(d.difference ?? 0)) }));
  };
  const onHandover = (s: Handover['status']) => {
    setHandoverOpen(false); invalidate();
    Alert.alert(s === 'confirmed' ? t('cash.handover_saved_confirmed') : t('cash.handover_saved_pending'));
  };

  const expensesOn = data?.settings.expenses_enabled !== false;
  const segments = useMemo(() => ([
    { key: 'week' as Segment, label: t('cash.seg_week'), icon: 'money' as const },
    ...(expensesOn ? [{ key: 'expenses' as Segment, label: t('expenses.title'), icon: 'note' as const }] : []),
    { key: 'notes' as Segment, label: t('cash.seg_notes'), icon: 'star' as const, badge: ins?.enabled ? ins.observations.length : 0 },
  ]), [t, expensesOn, ins]);

  const teacherHandovers = data?.role === 'teacher' ? data.pending_handovers : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* Hero: her greeting, the week, the gear. */}
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="forward" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#fff' }}>{t('cash.persona_name')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{t('cash.screen_title')}</Text>
            </View>
            {data?.role === 'teacher' ? (
              <TouchableOpacity onPress={() => setSettingsOpen(true)} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="settings" size={20} color="#fff" outline />
              </TouchableOpacity>
            ) : <View style={{ width: 40 }} />}
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{ins?.context?.greeting ?? ''}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2, marginBottom: spacing.lg }}>
            {ins?.context?.season ?? (data ? t('cash.week_of', { start: formatShortDate(data.week.start), end: formatShortDate(data.week.end) }) : '')}
          </Text>
          {data ? <NowCard data={data} onDone={onDone} onOpenHandovers={() => setHandoverOpen(true)} /> : <ActivityIndicator color="#fff" />}
        </LinearGradient>

        {/* Segments — sticky, so switching never means scrolling back up. */}
        <View style={{ backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSunken, borderRadius: radius.full, padding: 4 }}>
            {segments.map((s) => {
              const on = segment === s.key;
              return (
                <TouchableOpacity key={s.key} onPress={() => setSegment(s.key)} activeOpacity={0.9}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.full, backgroundColor: on ? colors.surface : 'transparent', ...(on ? shadows.sm : {}) }}>
                  <Icon name={s.icon} size={16} color={on ? colors.brand : colors.textTertiary} outline={!on} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.brand : colors.textSecondary }}>{s.label}</Text>
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

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          {isLoading || !data ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : segment === 'week' ? (
            <WeekSegment data={data} onChanged={invalidate} onOpenHandover={() => setHandoverOpen(true)} />
          ) : segment === 'expenses' ? (
            <ExpensesPanel embedded />
          ) : (
            <View>
              {introSeen === false ? (
                <View style={{ backgroundColor: colors.accentLight, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('cash.intro_line1')}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 22 }}>{t('cash.intro_line2')}</Text>
                  <TouchableOpacity onPress={dismissIntro} style={{ alignSelf: 'flex-start', marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.accent }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('cash.intro_dismiss')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <Observations items={ins?.enabled ? ins.observations : []} />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Handovers: the assistant records one; the teacher confirms the pending ones or records a receipt. */}
      <Sheet open={handoverOpen} onClose={() => setHandoverOpen(false)} title={t('cash.handovers')}>
        {data?.role === 'teacher' ? (
          <View>
            {teacherHandovers.length > 0 ? (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('cash.handover_pending_title')}</Text>
                {teacherHandovers.map((h) => <HandoverRow key={h.id} h={h} onReview={(x, d) => review.mutate({ id: x.id, d })} />)}
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

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t('cash.settings_title')}>
        {data?.role === 'teacher' ? <SettingsBody v={data} onChanged={invalidate} /> : null}
      </Sheet>
    </View>
  );
}

/** الأسبوع: the drawers, then handovers, then (teacher) the running totals. */
function WeekSegment({ data, onChanged, onOpenHandover }: { data: CashView; onChanged: () => void; onOpenHandover: () => void }) {
  const { t } = useTranslation();
  const egp = t('insights.egp');
  const isTeacher = data.role === 'teacher';

  const handoverButton = (
    <TouchableOpacity onPress={onOpenHandover} activeOpacity={0.85}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, borderStyle: 'dashed', marginBottom: spacing.md }}>
      <Icon name="transfer" size={18} color={colors.brand} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{isTeacher ? t('cash.handover_received') : t('cash.handover_add')}</Text>
    </TouchableOpacity>
  );

  if (data.role === 'assistant') {
    const v: AssistantCashView = data;
    const shown = v.drawers.filter((d) => !v.unanswered.some((u) => u.id === d.id));
    return (
      <View>
        {shown.length === 0 && v.unanswered.length === 0 ? <EmptyState icon="success" title={t('cash.no_prompt')} message={t('cash.no_prompt_hint')} /> : null}
        {shown.map((d) => <DrawerCard key={d.id} d={d} isTeacher={false} onChanged={onChanged} />)}
        {v.collections ? <CollectionsList events={v.collections} byKind={v.collected_by_kind} own /> : null}
        {handoverButton}
        {v.handovers.map((h) => <HandoverRow key={h.id} h={h} />)}
      </View>
    );
  }

  const v: TeacherCashView = data;
  const olderGaps = v.open_gaps.filter((g) => g.week_start !== v.week.start);
  return (
    <View>
      {/* The week in three numbers. */}
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
      {/* Where the week's money sits — the base of every drawer's equation, from the collection ledger. */}
      {v.collected_breakdown ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: -spacing.xs, marginBottom: spacing.md }}>
          {t('cash.collected_split', { assistants: money(v.collected_breakdown.cash_by_assistants), teacher: money(v.collected_breakdown.cash_by_teacher) })}
          {v.collected_breakdown.digital > 0 ? ` · ${t('cash.collected_digital', { amount: money(v.collected_breakdown.digital) })}` : ''}
          {v.collected_breakdown.unattributed > 0 ? ` · ${t('cash.collected_unattributed', { amount: money(v.collected_breakdown.unattributed) })}` : ''}
        </Text>
      ) : null}
      {v.registry_now ? <RegistryNowCard r={v.registry_now} byKind={v.collected_breakdown?.by_kind} /> : null}

      {v.drawers.length === 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' }}>{t('cash.no_assistants')}</Text>
      ) : (
        v.drawers.map((d) => <DrawerCard key={d.id} d={d} name={d.name} isTeacher onChanged={onChanged} />)
      )}

      {v.collections ? <CollectionsList events={v.collections} byKind={v.collected_breakdown?.by_kind} own={false} /> : null}

      {handoverButton}
      {v.week_handovers.map((h) => <HandoverRow key={h.id} h={h} />)}

      {olderGaps.length > 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('cash.open_gaps_title')}</Text>
          {olderGaps.map((g) => <DrawerCard key={g.id} d={g} name={g.name} isTeacher onChanged={onChanged} />)}
        </View>
      ) : null}

      {v.running_totals.length > 0 ? (
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
      ) : null}
    </View>
  );
}
