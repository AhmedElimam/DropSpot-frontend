import { useEffect, useMemo, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { FilterChips } from '@/components/ui/FilterChips';
import { StatsCard } from '@/components/layout/StatsCard';
import { getTeacherInsights, getInsightsPdfUrl, type TeacherInsights, type TrendDay, type InsightsRangeKey } from '@/api/insights';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { openRemotePdf } from '@/utils/openPdf';

const VENUE_KEY = 'insights_venue_filter';

function CashLine({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: tint ?? colors.textPrimary }}>{value}</Text>
    </View>
  );
}

/**
 * Shown before the first response arrives, so the period bar is never a blank strip.
 * The server sends its own list with the bundle and that one wins once it lands — this
 * is a placeholder, not a second source of truth.
 */
const FALLBACK_PRESETS: { key: InsightsRangeKey; label: string }[] = [
  { key: 'month', label: 'هذا الشهر' },
  { key: 'last_month', label: 'الشهر الماضي' },
  { key: 'last30', label: 'آخر ٣٠ يومًا' },
  { key: 'last90', label: 'آخر ٣ شهور' },
  { key: 'all', label: 'كل الوقت' },
];

/**
 * Full teacher insights screen (pushed from the "الإدارة" hub). Mirrors the web
 * /insights page — attendance, absence, financial, and growth — from the shared
 * TeacherInsightsService via /teacher/insights.
 */
export default function InsightsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // The chosen period drives the query key, so switching it refetches rather than
  // re-labelling stale numbers.
  const [range, setRange] = useState<InsightsRangeKey>('month');
  // Venue filter (venues addendum §4): 'all', a venue id, or 'general'. Persisted between
  // visits — a teacher who manages one centre closely will look at it most.
  //
  // The saved venue is read BEFORE the first fetch (`venueReady`). It used to arrive a beat
  // after the screen opened: the page fetched "all", then refetched the saved venue — and
  // if the teacher had already tapped a chip in between, the late read overwrote the tap.
  const [venue, setVenueState] = useState<'all' | 'general' | number>('all');
  const [venueReady, setVenueReady] = useState(false);
  const touchedRef = useRef(false);
  useEffect(() => {
    SecureStore.getItemAsync(VENUE_KEY).then((v) => {
      if (!v || touchedRef.current) return;
      setVenueState(v === 'general' ? 'general' : v === 'all' ? 'all' : Number(v) || 'all');
    }).catch(() => {}).finally(() => setVenueReady(true));
  }, []);
  const setVenue = (v: 'all' | 'general' | number) => {
    touchedRef.current = true;
    setVenueReady(true);
    setVenueState(v);
    SecureStore.setItemAsync(VENUE_KEY, String(v)).catch(() => {});
  };
  const venueParam = venue === 'all' ? undefined : venue;
  const [exporting, setExporting] = useState(false);
  const q = useQuery({
    queryKey: ['teacher-insights', range, venue],
    queryFn: () => getTeacherInsights({ range, venue: venueParam }),
    enabled: venueReady,
    // Keep the previous period on screen while the new one loads, so switching periods
    // reads as the numbers changing rather than the page emptying. It is dimmed and a
    // spinner sits by the title meanwhile, so old figures never pass for new ones.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const d = q.data;
  const switching = q.isPlaceholderData && q.isFetching;
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  // The venue chips outlive a failed fetch: they used to come only from the latest
  // response, so one error emptied the page AND took away the chips needed to step back.
  const venuesRef = useRef<{ id: number; name: string | null }[]>([]);
  const perVenueRef = useRef(false);
  if (d?.venues) venuesRef.current = d.venues;
  if (d?.cash_settings) perVenueRef.current = !!d.cash_settings.per_venue;
  const venueList = venuesRef.current;

  // A saved venue that no longer exists (deleted, or another teacher's) falls back to
  // "all" instead of silently filtering by a chip that isn't there.
  useEffect(() => {
    if (!d?.venues) return;
    if (typeof venue === 'number' && !d.venues.some((v) => v.id === venue)) setVenue('all');
    if (venue === 'general' && !d.cash_settings?.per_venue) setVenue('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.venues, d?.cash_settings?.per_venue, venue]);

  const venueOptions = useMemo(() => [
    { key: 'all' as const, label: t('insights.venue_all') },
    ...venueList.map((v) => ({ key: v.id as 'all' | 'general' | number, label: v.name ?? '' })),
    ...(perVenueRef.current ? [{ key: 'general' as const, label: t('insights.venue_general') }] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [venueList, perVenueRef.current, t]);

  const money = (v: number) => `${Math.round(v).toLocaleString('en-US')} ${t('insights.egp')}`;
  const presets = d?.presets?.length ? d.presets : FALLBACK_PRESETS;
  const rangeLabel = d?.range?.label ?? presets.find((p) => p.key === range)?.label ?? '';

  // Ask for a fresh signed link every time, then download + share it — the same flow as
  // the student performance sheet, which is what works on Samsung's download manager.
  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const url = await getInsightsPdfUrl({ range, venue: venueParam });
      if (!url) throw new Error('no url');
      await openRemotePdf(url, `تحليلات-${rangeLabel || range}`);
    } catch {
      Alert.alert(t('common.error'), t('insights.export_failed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('insights.title')}</Text>
          {switching ? <ActivityIndicator size="small" color={colors.brand} /> : null}
        </View>
        <TouchableOpacity
          onPress={exportPdf}
          disabled={exporting || !d || switching}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: spacing.md, height: 40, borderRadius: 12,
            backgroundColor: colors.brand + '18', opacity: exporting || !d || switching ? 0.5 : 1,
          }}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <Icon name="reports" size={18} color={colors.brand} />
          )}
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('insights.export_pdf')}</Text>
        </TouchableOpacity>
      </View>

      {/* Period bar — every number below answers the question this row is asking. */}
      <FilterChips options={presets} value={range} onChange={setRange} />

      {/* Venue filter — every figure below follows it, including the cash block. */}
      {venueList.length > 0 ? (
        <FilterChips options={venueOptions} value={venue} onChange={setVenue} tone="soft" icon="gps" />
      ) : null}

      {q.isLoading || !venueReady ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : !d ? (
        <View style={{ alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg }}>
          <Icon name="reports" size={40} color={colors.textTertiary} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }}>
            {q.isError ? t('insights.load_failed') : t('insights.no_data')}
          </Text>
          {q.isError ? (
            <TouchableOpacity onPress={() => q.refetch()} style={{ marginTop: spacing.md, paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.full, backgroundColor: colors.brandTint, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('common.retry')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <ScrollView
          style={{ opacity: switching ? 0.45 : 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Attendance */}
          <Section title={t('insights.attendance')} />
          <Row>
            <StatsCard label={t('insights.attendance_rate')} value={`${d.attendance.rate}%`} color={colors.success} bgColor={colors.success + '18'} />
            <StatsCard label={t('insights.on_time_rate')} value={`${d.attendance.on_time_rate}%`} />
          </Row>
          <Row>
            <StatsCard label={t('insights.active_students')} value={d.attendance.active_students} />
            <StatsCard label={t('insights.sessions_held')} value={d.attendance.sessions_held} />
          </Row>
          <TrendBars trend={d.attendance.trend} max={d.attendance.trend_max} label={t('insights.trend_days', { days: d.attendance.trend.length })} />
          <PerCourse insights={d} title={t('insights.per_course')} />

          {/* Absence */}
          <Section title={t('insights.absence')} />
          <Row>
            <StatsCard label={t('insights.absent_count')} value={d.absence.absent} color={colors.danger} bgColor={colors.danger + '18'} />
            <StatsCard label={t('insights.at_risk')} value={d.absence.at_risk} color={colors.warning} bgColor={colors.warning + '18'} />
          </Row>
          <Row>
            <StatsCard label={t('insights.termination_candidates')} value={d.absence.termination_candidates} />
            <StatsCard label={t('insights.dormant')} value={d.absence.dormant} />
          </Row>
          {d.absence.top_at_risk.length > 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('insights.top_at_risk')}</Text>
              {d.absence.top_at_risk.map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>{s.name}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: s.rate < 60 ? colors.danger : colors.warning }}>{s.rate}%</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Financial */}
          <Section title={t('insights.financial')} />
          <Row>
            <StatsCard label={`${t('insights.collected')} — ${rangeLabel}`} value={money(d.financial.collected ?? d.financial.collected_this_month)} color={colors.success} bgColor={colors.success + '18'} />
            <StatsCard label={t('insights.outstanding_now')} value={money(d.financial.outstanding)} />
          </Row>
          <Row>
            <StatsCard label={t('insights.overdue')} value={money(d.financial.overdue)} color={colors.danger} bgColor={colors.danger + '18'} />
            <StatsCard label={t('insights.new_students_period')} value={d.growth.new_students} color={colors.brand} bgColor={colors.brand + '18'} />
          </Row>

          {/* Collected vs actual (addendum §5). "Actual" only for reconciled weeks; unreconciled
              weeks are listed apart with the actual UNKNOWN — never zero, never = collected. */}
          {d.cash ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.sm }}>{t('insights.cash_title')}</Text>
              {d.cash.reconciled.weeks === 0 && d.cash.unreconciled.weeks === 0 ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('insights.cash_none')}</Text>
              ) : null}
              {d.cash.reconciled.weeks > 0 ? (
                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.success }}>{t('insights.cash_reconciled_weeks', { count: d.cash.reconciled.weeks })}</Text>
                  <CashLine label={t('insights.cash_collected')} value={money(d.cash.reconciled.collected)} />
                  <CashLine label={t('insights.cash_actual')} value={money(d.cash.reconciled.actual)} />
                  {d.cash.expenses_enabled ? <CashLine label={t('insights.cash_expenses')} value={money(d.cash.reconciled.expenses)} /> : null}
                  <CashLine label={t('insights.cash_difference')} value={`${d.cash.reconciled.difference > 0 ? '+' : ''}${money(d.cash.reconciled.difference)}`} tint={d.cash.reconciled.difference === 0 ? colors.success : d.cash.reconciled.difference < 0 ? colors.danger : colors.warningDark} />
                </View>
              ) : null}
              {d.cash.unreconciled.weeks > 0 ? (
                <View>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.warningDark }}>{t('insights.cash_unreconciled_weeks', { count: d.cash.unreconciled.weeks })}</Text>
                  <CashLine label={t('insights.cash_collected')} value={money(d.cash.unreconciled.collected)} />
                  <CashLine label={t('insights.cash_actual')} value={t('insights.cash_unknown')} tint={colors.warningDark} />
                  {d.cash.expenses_enabled ? <CashLine label={t('insights.cash_expenses')} value={money(d.cash.unreconciled.expenses)} /> : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function Section({ title }: { title: string }) {
  return <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.xl, marginBottom: spacing.sm }}>{title}</Text>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>{children}</View>;
}

function TrendBars({ trend, max, label }: { trend: TrendDay[]; max: number; label: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 3 }}>
        {trend.map((day, i) => {
          const total = day.present + day.late + day.absent;
          const h = max > 0 ? Math.round((total / max) * 80) : 0;
          const attended = day.present + day.late;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <View style={{ width: '75%', height: Math.max(h, 2), borderRadius: 3, backgroundColor: colors.surfaceSunken, overflow: 'hidden', justifyContent: 'flex-end' }}>
                <View style={{ height: total > 0 ? `${Math.round((attended / total) * 100)}%` : '0%', backgroundColor: colors.success }} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PerCourse({ insights, title }: { insights: TeacherInsights; title: string }) {
  if (!insights.attendance.per_course.length) return null;
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{title}</Text>
      {insights.attendance.per_course.map((c, i) => (
        <View key={i} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>{c.name}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: c.rate >= 80 ? colors.success : c.rate >= 60 ? colors.brand : colors.danger }}>{c.rate}%</Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceSunken, overflow: 'hidden' }}>
            <View style={{ width: `${c.rate}%`, height: '100%', backgroundColor: c.rate >= 80 ? colors.success : c.rate >= 60 ? colors.brand : colors.danger }} />
          </View>
        </View>
      ))}
    </View>
  );
}
