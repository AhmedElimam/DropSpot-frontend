import { track } from '@/lib/analytics';
import { memo, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { FlatList, ScrollView } from '@/components/ui/Refreshable';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, useDialogPersona } from '@/ui/dialog';
import { reverseStudentPayment } from '@/api/students';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormScreen } from '@/components/ui/Form';
import { RosePortrait } from '@/components/rose/RoseStamp';
import { useRose } from '@/hooks/useRose';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { isNetworkFailure } from '@/db/marksSync';
import { formatNumber, formatShortDate, formatTime, formatDayDate } from '@/utils/format';
import { getCashCollections, type CollectionItem, type CollectionKind, type CollectionStudent } from '@/api/cash';

const KIND = (): Record<CollectionKind, { label: string; icon: IconName; tint: string }> => ({
  bill: { label: 'فواتير', icon: 'invoices', tint: colors.brand },
  booklet: { label: 'ملازم', icon: 'book', tint: colors.info },
  booking: { label: 'حجز', icon: 'card', tint: colors.accent },
  guest_pass: { label: 'مراجعة', icon: 'quiz', tint: colors.success },
});
const ORDER: CollectionKind[] = ['bill', 'booklet', 'booking', 'guest_pass'];

const money = (n: number) => `${formatNumber(Math.round(n))} ج.م`;

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** One student: who, what kinds, how much — tap to see each payment. */
const StudentRow = memo(function StudentRow({ s, kind, open, onToggle, onRefuse, busyKey }: {
  s: CollectionStudent; kind: CollectionKind | null; open: boolean; onToggle: () => void;
  /** Teacher only: reverse this payment (the student page's «إلغاء الدفع»). */
  onRefuse?: (s: CollectionStudent, i: CollectionItem) => void;
  busyKey: string | null;
}) {
  const items = kind ? s.items.filter((i) => i.kind === kind) : s.items;
  const total = items.reduce((n, i) => n + i.amount, 0);
  const initial = s.name.trim().charAt(0) || '؟';
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: open ? colors.brand : colors.border, marginBottom: spacing.sm, overflow: 'hidden' }}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brand + '18', alignItems: 'center', justifyContent: 'center' }}>
          {s.student_id ? <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.brand }}>{initial}</Text> : <Icon name="quiz" size={20} color={colors.success} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{s.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
            {ORDER.filter((k) => s.kinds.includes(k) && (!kind || k === kind)).map((k) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: KIND()[k].tint + '18', borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 1 }}>
                <Icon name={KIND()[k].icon} size={11} color={KIND()[k].tint} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: KIND()[k].tint }}>{KIND()[k].label}</Text>
              </View>
            ))}
            {items.length > 1 ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{`${formatNumber(items.length)} دفعات`}</Text> : null}
          </View>
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.successText }}>{money(total)}</Text>
        <Icon name={open ? 'up' : 'down'} size={16} color={colors.textTertiary} />
      </TouchableOpacity>
      {open ? (
        <View style={{ borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSunken, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}>
          {items.map((i, n) => {
            const k = KIND()[i.kind];
            return (
              <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: k.tint + '1F', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={k.icon} size={15} color={k.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>{i.label ?? k.label}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>
                    {[i.collected_at ? `${formatDayDate(i.collected_at)} · ${formatTime(i.collected_at)}` : null, i.collector, i.method === 'digital' ? 'تحويل' : null].filter(Boolean).join(' · ')}
                  </Text>
                  {i.reversed > 0 ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.dangerText, marginTop: 1 }}>{`أُعيد منه ${money(i.reversed)}`}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{money(i.amount)}</Text>
                  {onRefuse && s.student_id && i.kind !== 'guest_pass' ? (
                    <TouchableOpacity onPress={() => onRefuse(s, i)} disabled={busyKey !== null} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`إلغاء دفع ${i.label ?? ''}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 28, paddingHorizontal: 8, borderRadius: 8, backgroundColor: colors.danger + '12', borderWidth: 1, borderColor: colors.danger + '55', opacity: busyKey !== null && busyKey !== `${s.student_id}:${i.kind}:${i.subject_id}` ? 0.5 : 1 }}>
                      {busyKey === `${s.student_id}:${i.kind}:${i.subject_id}` ? <ActivityIndicator size="small" color={colors.danger} /> : <Icon name="undo" size={12} color={colors.danger} />}
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.danger }}>إلغاء الدفع</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});

/**
 * «تحصيلات الأسبوع» — on مدام روز's desk (founder 2026-10-10: «who have we collected from this
 * week and what from each student, with filters booking, booklets or a normal invoice»).
 * Her week (Friday–Thursday), from the cash ledger her drawer figures are summed from; an
 * assistant sees what they collected. Step back through past weeks with the arrows.
 */
export default function CashCollectionsScreen() {
  useDialogPersona('rose');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const rose = useRose();
  const params = useLocalSearchParams<{ week?: string }>();
  const [week, setWeek] = useState<string | null>(params.week ?? null);
  const [kind, setKind] = useState<CollectionKind | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['cash-collections', week ?? 'now'], queryFn: () => getCashCollections(week ?? undefined) });
  const qc = useQueryClient();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // «إلغاء الدفع» — the student page's own reverse (teacher only, audited, the due comes back).
  // Live only: money going back is never parked offline.
  const refuse = (s: CollectionStudent, i: CollectionItem) => {
    if (!s.student_id || i.kind === 'guest_pass') return;
    const what = i.label ?? KIND()[i.kind].label;
    Alert.alert(
      t('cash.refuse_title', { name: s.name }),
      t('cash.refuse_body', { what, amount: money(i.amount) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('cash.refuse_confirm'), style: 'destructive', onPress: async () => {
            const key = `${s.student_id}:${i.kind}:${i.subject_id}`;
            setBusyKey(key);
            try {
              await reverseStudentPayment(s.student_id!, i.kind as 'bill' | 'booklet' | 'booking', i.subject_id);
              track('payment_reversed', { kind: i.kind, value: Math.round(i.amount), currency: 'EGP', source: 'week_collections' });
              await Promise.all([
                qc.invalidateQueries({ queryKey: ['cash-collections'] }),
                qc.invalidateQueries({ queryKey: ['cash-reconciliation'] }),
                qc.invalidateQueries({ queryKey: ['pending-collections'] }),
                qc.invalidateQueries({ queryKey: ['teacher-student', String(s.student_id)] }),
                qc.invalidateQueries({ queryKey: ['cash-insights'] }),
              ]);
              Alert.alert(t('cash.refuse_done'), t('cash.refuse_done_body', { name: s.name }));
            } catch (e) {
              Alert.alert(t('common.error'), isNetworkFailure(e) ? t('cash.refuse_needs_connection') : getFriendlyErrorMessage(e));
            } finally {
              setBusyKey(null);
            }
          },
        },
      ],
    );
  };
  const { refreshing, onRefresh } = usePullRefresh(query.refetch);
  const d = query.data;

  const step = (days: number) => {
    const base = d ? new Date(d.week.start) : new Date();
    base.setDate(base.getDate() + days);
    const today = new Date();
    setOpen(null);
    setWeek(base > today ? null : isoDay(base));
  };
  const isCurrent = week === null;

  const list = useMemo(() => {
    const needle = q.trim();
    return (d?.students ?? [])
      .filter((s) => !kind || s.kinds.includes(kind))
      .filter((s) => !needle || s.name.includes(needle));
  }, [d, kind, q]);
  const shownTotal = useMemo(
    () => list.reduce((n, s) => n + s.items.filter((i) => !kind || i.kind === kind).reduce((m, i) => m + i.amount, 0), 0),
    [list, kind],
  );
  const kinds = ORDER.filter((k) => k !== 'guest_pass' || (d?.by_kind.guest_pass?.count ?? 0) > 0);

  return (
    <FormScreen
      title={t('cash.who_paid_title')}
      subtitle={d ? t('cash.week_of', { start: formatShortDate(d.week.start), end: formatShortDate(d.week.end) }) : null}
      scroll={false}
      right={rose.named ? <RosePortrait size={44} nod={false} /> : null}
    >
      {query.isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : !d ? (
        isNetworkFailure(query.error)
          ? <EmptyState icon="warning" title={t('offline.not_saved_title')} message={t('offline.not_saved_rose', { rose: rose.name })} />
          : <EmptyState icon="refresh" title={t('cash.load_failed')} />
      ) : (
        <FlatList showsVerticalScrollIndicator={false}
          data={list}
          keyExtractor={(s) => String(s.student_id ?? 'guests')}
          renderItem={({ item }) => {
            const key = String(item.student_id ?? 'guests');
            return <StudentRow s={item} kind={kind} open={open === key} onToggle={() => setOpen(open === key ? null : key)} onRefuse={d.scope === 'teacher' ? refuse : undefined} busyKey={busyKey} />;
          }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View style={{ paddingTop: spacing.md }}>
              {/* Her week: back through past weeks, forward to this one. RTL: › = earlier. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                <TouchableOpacity onPress={() => step(-7)} accessibilityRole="button" accessibilityLabel={t('cash.collections_prev')}
                  style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="forward" size={18} color={colors.brand} />
                </TouchableOpacity>
                <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
                  {isCurrent ? t('cash.collections_this_week') : t('cash.week_of', { start: formatShortDate(d.week.start), end: formatShortDate(d.week.end) })}
                </Text>
                <TouchableOpacity onPress={() => step(7)} disabled={isCurrent} accessibilityRole="button" accessibilityLabel={t('cash.collections_next')}
                  style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', opacity: isCurrent ? 0.35 : 1 }}>
                  <Icon name="back" size={18} color={colors.brand} />
                </TouchableOpacity>
              </View>

              {/* The week in one card: the total, how many paid, cash vs transfer. */}
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{d.scope === 'mine' ? t('cash.who_paid_mine') : t('cash.collections_total')}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 30, color: colors.successText, marginTop: 2 }}>{money(d.total)}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  {t('cash.collections_from', { count: d.students_count })}
                  {d.digital > 0 ? `  ·  ${t('cash.collections_split', { cash: money(d.cash), digital: money(d.digital) })}` : ''}
                </Text>
              </View>

              {/* What: each kind with its money and how many paid it. */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}>
                {[null, ...kinds].map((k) => {
                  const on = kind === k;
                  const meta = k ? KIND()[k] : null;
                  const tint = meta?.tint ?? colors.brand;
                  const amount = k ? d.by_kind[k]?.amount ?? 0 : d.total;
                  const who = k ? d.by_kind[k]?.students ?? 0 : d.students_count;
                  return (
                    <TouchableOpacity key={k ?? 'all'} onPress={() => { setKind(k); setOpen(null); }} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
                      style={{ minWidth: 104, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: on ? tint : colors.surface, borderWidth: 1, borderColor: on ? tint : colors.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        {meta ? <Icon name={meta.icon} size={14} color={on ? '#fff' : tint} /> : null}
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? '#fff' : colors.textPrimary }}>{meta?.label ?? t('cash.collections_all')}</Text>
                      </View>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: on ? '#fff' : tint, marginTop: 3 }}>{money(amount)}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: on ? 'rgba(255,255,255,0.85)' : colors.textTertiary }}>{t('cash.collections_students', { count: who })}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {(d.students?.length ?? 0) > 6 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 44, marginBottom: spacing.md }}>
                  <Icon name="search" size={16} color={colors.textTertiary} />
                  <TextInput value={q} onChangeText={setQ} placeholder={t('cash.collections_search')} placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, textAlign: 'right' }} />
                </View>
              ) : null}

              {kind || q ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginBottom: spacing.sm }}>
                  {t('cash.collections_filtered', { count: list.length, amount: money(shownTotal) })}
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="money" title={kind || q ? t('cash.collections_none_filter') : t('cash.collections_none')} message={kind || q ? undefined : t('cash.collections_none_hint')} />
          }
        />
      )}
    </FormScreen>
  );
}
