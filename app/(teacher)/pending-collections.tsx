import { SheetModal } from '@/components/ui/SheetModal';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Alert } from 'react-native';
import { FlatList, ScrollView } from '@/components/ui/Refreshable';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getStudentDetail } from '@/api/students';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, gradients } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { GeneratedAvatar, avatarSeed } from '@/components/ui/GeneratedAvatar';
import { formatNumber } from '@/utils/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatEGP } from '@/utils/currency';
import { BillingYearSheet, type BillingYearTarget } from '@/components/teacher/BillingYearSheet';
import { getPendingCollections, collectFromRoster, cancelDueFromRoster, type RosterStudent, type CollectKind } from '@/api/pendingCollections';
import { reverseStudentPayment } from '@/api/students';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { TeacherTip } from '@/components/TeacherTip';

interface Target {
  studentId: number;
  name: string;
  kind: CollectKind;
  label: string;
  remaining: number;
}

type State = 'overdue' | 'due' | 'settled';
type Filter = 'owing' | 'overdue' | 'settled' | 'all';

interface Summary { s: RosterStudent; remaining: number; paid: number; state: State }

interface Line {
  key: string; kind: CollectKind; chargeId?: number; icon: IconName; label: string;
  remaining: number; paid: number; original: number; overdue: boolean; collectLabel: string;
}

/** A student's whole position: what is still out across bill + booklets + bookings. */
function summarise(s: RosterStudent): Summary {
  const dues = [...s.booklets, ...s.bookings];
  const remaining = (s.bill?.total ?? 0) + dues.reduce((n, d) => n + (d.remaining ?? d.amount ?? 0), 0);
  const paid = (s.bill?.paid ?? 0) + dues.reduce((n, d) => n + (d.paid ?? 0), 0);
  const state: State = remaining <= 0 ? 'settled' : s.bill?.overdue ? 'overdue' : 'due';
  return { s, remaining, paid, state };
}

const STATE_RANK: Record<State, number> = { overdue: 0, due: 1, settled: 2 };

// Live tokens (the scheme can change under a mounted screen): a function, not a constant.
const STATE_TONE = (): Record<State, { stripe: string; bg: string; fg: string; label: string }> => ({
  overdue: { stripe: colors.danger, bg: colors.dangerLight, fg: colors.dangerText, label: 'collections.overdue' },
  due: { stripe: colors.warning, bg: colors.warningLight, fg: colors.warningText, label: 'collections.due' },
  settled: { stripe: colors.success, bg: colors.successLight, fg: colors.successText, label: 'collections.fully_paid' },
});

export default function TeacherPendingCollections() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  // Server-owned switch. The button ships over the air rather than through a store review,
  // so the super-admin can withdraw it without waiting for another release; the endpoint
  // refuses the call too, which is what actually protects a phone still on the old bundle.
  const { data: flags } = useFeatureFlags();
  // Undoing a payment and cancelling a due are the teacher's; the server refuses every
  // assistant, so they never see those buttons (founder 2026-09-26).
  const { isAssistant } = useActiveAbilities();
  const canCancelDue = !!flags?.cancel_pending_due && !isAssistant;
  const canReverse = !isAssistant;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pending-collections'],
    queryFn: getPendingCollections,
  });
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const [target, setTarget] = useState<Target | null>(null);
  const [yearFor, setYearFor] = useState<BillingYearTarget | null>(null);
  // Tapping a student opens their profile as a native sheet over the list (founder
  // 2026-10-06). The profile is fetched as the finger lifts, so the sheet usually rises with
  // it already there; the list refreshes when the sheet goes away.
  const openStudent = (studentId: number, name: string) => {
    void qc.prefetchQuery({ queryKey: ['teacher-student', String(studentId)], queryFn: () => getStudentDetail(studentId), staleTime: 15_000 });
    router.push({ pathname: '/(teacher)/student-sheet/[id]', params: { id: String(studentId), name } } as unknown as Href);
  };
  const seen = useRef(false);
  useFocusEffect(useCallback(() => {
    if (seen.current) void refetch();
    seen.current = true;
  }, [refetch]));
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const openCollect = (tg: Target) => {
    setTarget(tg);
    setAmount(String(tg.remaining));
  };

  const submit = async () => {
    if (!target) return;
    const amt = Number(amount);
    if (!(amt > 0)) return;
    setBusy(true);
    try {
      const res = await collectFromRoster(target.studentId, target.kind, amt);
      await qc.invalidateQueries({ queryKey: ['pending-collections'] });
      setTarget(null);
      Alert.alert('', res.remaining && Number(res.remaining) > 0
        ? t('collections.collected_partial', { amount: res.amount, remaining: res.remaining })
        : t('collections.collected_full'));
    } catch {
      Alert.alert(t('common.error'), t('collections.collect_failed'));
    } finally {
      setBusy(false);
    }
  };

  // Cancel a student's collected payment straight from a roster row (per-student, in-UI —
  // no toast). Shown to the teacher only; the reverse endpoint re-checks.
  const cancelPayment = (studentId: number, name: string, kind: CollectKind, chargeId?: number) => {
    Alert.alert('إلغاء الدفع', `إلغاء دفع «${name}»؟ ستعود مستحقّاته كما كانت.`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'إلغاء الدفع', style: 'destructive', onPress: async () => {
          try { await reverseStudentPayment(studentId, kind, chargeId); await qc.invalidateQueries({ queryKey: ['pending-collections'] }); }
          catch { Alert.alert(t('common.error'), 'تعذّر إلغاء الدفع'); }
        },
      },
    ]);
  };

  // «إلغاء المستحق» — write a due off WITHOUT collecting it. The opposite of cancelPayment
  // above: that puts a debt BACK after undoing a payment, this forgives one never paid. The
  // confirm names the amount, because the teacher is giving up money and the roster row it
  // is tapped from shows a remainder, not a total.
  const cancelDue = (studentId: number, name: string, kind: CollectKind, remaining: number, chargeId?: number) => {
    Alert.alert(
      'إلغاء المستحق',
      `إلغاء مستحق «${name}» بقيمة ${formatEGP(remaining)} دون تحصيل؟ لن يُطلب من الطالب دفعه.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'إلغاء المستحق', style: 'destructive', onPress: async () => {
            try {
              await cancelDueFromRoster(studentId, kind, chargeId);
              await qc.invalidateQueries({ queryKey: ['pending-collections'] });
            } catch (e: any) {
              // Show the server's own sentence when it sent one — it names the actual
              // reason; the generic line is only for a dead network.
              Alert.alert(t('common.error'), e?.message || 'تعذّر إلغاء المستحق — تحقّق من الاتصال');
            }
          },
        },
      ],
    );
  };

  // ── What the page shows: every student who owes or paid, the ones who owe first ─────
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('owing');
  const rows = useMemo(() => (data ?? []).map(summarise), [data]);
  const totals = useMemo(() => rows.reduce((t, r) => ({
    remaining: t.remaining + r.remaining, paid: t.paid + r.paid,
    overdue: t.overdue + (r.state === 'overdue' ? 1 : 0), owing: t.owing + (r.state !== 'settled' ? 1 : 0),
    settled: t.settled + (r.state === 'settled' ? 1 : 0),
  }), { remaining: 0, paid: 0, overdue: 0, owing: 0, settled: 0 }), [rows]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (filter === 'all' ? true : filter === 'owing' ? r.state !== 'settled' : r.state === filter))
      .filter((r) => !q || r.s.name.toLowerCase().includes(q) || (r.s.code ?? '').toLowerCase().includes(q))
      .sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || b.remaining - a.remaining);
  }, [rows, filter, search]);
  const pills: { key: Filter; label: string; n: number; dot?: string }[] = [
    { key: 'owing', label: t('collections.f_owing'), n: totals.owing, dot: colors.warning },
    { key: 'overdue', label: t('collections.overdue'), n: totals.overdue, dot: colors.danger },
    { key: 'settled', label: t('collections.fully_paid'), n: totals.settled, dot: colors.success },
    { key: 'all', label: t('collections.f_all'), n: rows.length },
  ];

  const renderStudent = ({ item: r }: { item: Summary }) => {
    const s = r.s;
    const tone = STATE_TONE()[r.state];
    const lines: Line[] = [
      ...(s.bill ? [{ key: 'bill', kind: 'bill' as CollectKind, icon: 'invoices' as IconName, label: t('collections.bill_line', { n: s.bill.count || 1 }), remaining: s.bill.total, paid: s.bill.paid, original: s.bill.original || s.bill.total + s.bill.paid, overdue: s.bill.overdue, collectLabel: t('collections.due_bill') }] : []),
      ...s.booklets.map((bk) => ({ key: `bk-${bk.id}`, kind: 'booklet' as CollectKind, chargeId: bk.id, icon: 'book' as IconName, label: bk.course ? `${t('collections.booklet')} · ${bk.course}` : t('collections.booklet'), remaining: bk.remaining ?? bk.amount, paid: bk.paid, original: bk.original, overdue: false, collectLabel: t('collections.due_booklet') })),
      ...s.bookings.map((bk) => ({ key: `bo-${bk.id}`, kind: 'booking' as CollectKind, chargeId: bk.id, icon: 'card' as IconName, label: bk.course ? `${t('collections.booking')} · ${bk.course}` : t('collections.booking'), remaining: bk.remaining, paid: bk.paid, original: bk.original, overdue: false, collectLabel: t('collections.due_booking') })),
    ].filter((l) => l.remaining > 0 || l.paid > 0);

    return (
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, borderStartWidth: 4, borderStartColor: tone.stripe, padding: spacing.md, marginBottom: spacing.sm }}>
        {/* Who, and what they owe — the number is the headline. A tap opens the student. */}
        <TouchableOpacity onPress={() => openStudent(s.student_id, s.name)} activeOpacity={0.7} accessibilityRole="button" accessibilityHint="عرض بيانات الطالب"
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <GeneratedAvatar seed={avatarSeed.student(s.student_id)} size={42} label={s.name} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{s.name}</Text>
              <Icon name="back" size={13} color={colors.textTertiary} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <View style={{ backgroundColor: tone.bg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: tone.fg }}>{t(tone.label)}</Text>
              </View>
              {s.code ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{s.code}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: r.state === 'settled' ? colors.successText : tone.fg }}>{formatEGP(r.state === 'settled' ? r.paid : r.remaining)}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{t(r.state === 'settled' ? 'collections.paid' : 'collections.remaining')}</Text>
          </View>
        </TouchableOpacity>

        {/* One line per due: what it is, how much of it is in, and the actions. */}
        {lines.map((l) => {
          const pct = l.original > 0 ? Math.min(1, l.paid / l.original) : 0;
          return (
            <View key={l.key} style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: l.overdue ? colors.dangerLight : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={l.icon} size={16} color={l.overdue ? colors.danger : colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>{l.label}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                    {l.remaining > 0
                      ? t('collections.paid_of', { paid: formatEGP(l.paid), total: formatEGP(l.original) })
                      : t('collections.fully_paid')}
                  </Text>
                </View>
                {l.remaining > 0 ? (
                  <TouchableOpacity
                    onPress={() => openCollect({ studentId: s.student_id, name: s.name, kind: l.kind, label: l.collectLabel, remaining: l.remaining })}
                    activeOpacity={0.85} accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: colors.success }}>
                    <Icon name="money" size={15} color="#fff" />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{formatEGP(l.remaining)}</Text>
                  </TouchableOpacity>
                ) : (
                  <Icon name="success" size={22} color={colors.success} />
                )}
              </View>
              {/* Progress: how much of this due is in. */}
              <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.surfaceSunken, marginTop: spacing.sm, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(pct * 100)}%`, height: 5, borderRadius: 3, backgroundColor: l.overdue && pct < 1 ? colors.danger : colors.success }} />
              </View>
              {(canReverse && l.paid > 0) || (canCancelDue && l.remaining > 0) ? (
                <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
                  {canReverse && l.paid > 0 ? (
                    <TouchableOpacity onPress={() => cancelPayment(s.student_id, s.name, l.kind, l.chargeId)} hitSlop={8}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.dangerText }}>إلغاء الدفع</Text>
                    </TouchableOpacity>
                  ) : null}
                  {canCancelDue && l.remaining > 0 ? (
                    <TouchableOpacity onPress={() => cancelDue(s.student_id, s.name, l.kind, l.remaining, l.chargeId)} hitSlop={8}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.warningText }}>إلغاء المستحق</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
        {/* «السنة»: the student's months — which month each bill is, edit it, bill a missing one. */}
        <TouchableOpacity onPress={() => setYearFor({ studentId: s.student_id, name: s.name })} hitSlop={6} accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
          <Icon name="calendar" size={15} color={colors.brand} />
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>السنة والفواتير — شهر بشهر</Text>
          <Icon name="back" size={14} color={colors.brand} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Ink hero: what is still out, what is late, what came in — then search and filters. */}
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.onHeroChip, justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="forward" size={22} color={colors.onHero} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.onHero }}>{t('collections.title')}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          {[
            { label: t('collections.stat_out'), value: formatEGP(totals.remaining), icon: 'money' as IconName, tint: colors.accent },
            { label: t('collections.stat_late'), value: formatNumber(totals.overdue), icon: 'warning' as IconName, tint: '#FF8A97' },
            { label: t('collections.stat_in'), value: formatEGP(totals.paid), icon: 'success' as IconName, tint: '#4ADE9B' },
          ].map((x) => (
            <View key={x.label} style={{ flex: 1, backgroundColor: colors.onHeroChip, borderRadius: radius.lg, padding: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name={x.icon} size={13} color={x.tint} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.onHeroSoft }} numberOfLines={1}>{x.label}</Text>
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onHero, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{x.value}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.onHeroChip, borderRadius: radius.lg, paddingHorizontal: spacing.md, marginTop: spacing.md }}>
          <Icon name="search" size={17} color={colors.onHeroSoft} />
          <TextInput value={search} onChangeText={setSearch} placeholder={t('collections.search_ph')} placeholderTextColor={colors.onHeroFaint}
            style={{ flex: 1, height: 40, marginStart: spacing.sm, fontFamily: fonts.regular, fontSize: 14, color: colors.onHero, textAlign: 'right', paddingVertical: 0 }} />
          {search ? <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}><Icon name="close" size={16} color={colors.onHeroSoft} /></TouchableOpacity> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm, marginHorizontal: -spacing.lg }}
          contentContainerStyle={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {pills.map((x) => {
            const on = filter === x.key;
            return (
              <TouchableOpacity key={x.key} onPress={() => setFilter(x.key)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? colors.heroChipActive : colors.onHeroChip }}>
                {x.dot ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: x.dot }} /> : null}
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.onHeroChipActive : colors.onHero }}>{x.label}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.onHeroChipActive : colors.onHeroSoft }}>{formatNumber(x.n)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <FlatList showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          data={shown}
          keyExtractor={(r) => String(r.s.student_id)}
          renderItem={renderStudent}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.xl + 64, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          ListEmptyComponent={rows.length
            ? <EmptyState icon="search" title={t('collections.empty_filter')} />
            : <EmptyState icon="money" title={t('collections.empty')} />}
        />
      )}

      {/* One page, two ways in (founder 2026-10-06: «a page made for two tabs is a bit much»):
          the list above, and — always in reach of the thumb — scanning the card. */}
      <TouchableOpacity onPress={() => router.push('/(teacher)/scan?payKind=all' as Href)} activeOpacity={0.9} accessibilityRole="button"
        style={{ position: 'absolute', bottom: insets.bottom + spacing.lg, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 54, paddingHorizontal: spacing.xl, borderRadius: radius.full, backgroundColor: colors.brand, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
        <Icon name="scan" size={22} color="#fff" />
        <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: '#fff' }}>امسح البطاقة للتحصيل</Text>
      </TouchableOpacity>

      <TeacherTip
        tip="billing"
        icon="money"
        titleKey="onboarding.tip_billing_title"
        bodyKey="onboarding.tip_billing_body"
        bulletKeys={['onboarding.tip_billing_b1', 'onboarding.tip_billing_b2']}
      />

      {/* Collect modal — amount input, default = full remainder. */}
      <SheetModal visible={!!target} onClose={() => setTarget(null)} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.xl, paddingBottom: spacing.xl + insets.bottom }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="money" size={24} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{target?.label}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>{target?.name}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{formatEGP(target?.remaining ?? 0)}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{t('collections.remaining')}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <TextInput
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
                style={{ flex: 1, height: 52, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, textAlign: 'center' }}
              />
              {[{ label: t('collections.full'), v: target?.remaining ?? 0 }, { label: t('collections.half'), v: Math.round((target?.remaining ?? 0) / 2) }].map((q) => {
                const on = Number(amount) === q.v;
                return (
                  <TouchableOpacity key={q.label} onPress={() => setAmount(String(q.v))}
                    style={{ paddingHorizontal: spacing.md, height: 52, justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, backgroundColor: on ? colors.brand : 'transparent' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? '#fff' : colors.brand }}>{q.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm }}>{t('collections.partial_hint')}</Text>

            <TouchableOpacity
              onPress={submit}
              disabled={busy || !(Number(amount) > 0)}
              activeOpacity={0.85}
              style={{ marginTop: spacing.lg, minHeight: 48, borderRadius: radius.md, backgroundColor: Number(amount) > 0 ? colors.success : colors.border, justifyContent: 'center', alignItems: 'center' }}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('collections.confirm')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTarget(null)} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('common.close')}</Text>
            </TouchableOpacity>
      </SheetModal>
      <BillingYearSheet target={yearFor} onClose={() => setYearFor(null)} />
    </View>
  );
}
