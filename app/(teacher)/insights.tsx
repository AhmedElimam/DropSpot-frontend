import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { StatsCard } from '@/components/layout/StatsCard';
import { getTeacherInsights, getInsightsPdfUrl, type TeacherInsights, type TrendDay, type InsightsRangeKey } from '@/api/insights';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { openRemotePdf } from '@/utils/openPdf';

/**
 * Shown before the first response arrives, so the period bar is never a blank strip.
 * The server sends its own list with the bundle and that one wins once it lands — this
 * is a placeholder, not a second source of truth.
 */
const VENUE_KEY = 'insights_venue_filter';

function CashLine({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: tint ?? colors.textPrimary }}>{value}</Text>
    </View>
  );
}

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
  const [venue, setVenueState] = useState<'all' | 'general' | number>('all');
  useEffect(() => {
    SecureStore.getItemAsync(VENUE_KEY).then((v) => {
      if (!v) return;
      setVenueState(v === 'general' ? 'general' : v === 'all' ? 'all' : Number(v) || 'all');
    }).catch(() => {});
  }, []);
  const setVenue = (v: 'all' | 'general' | number) => {
    setVenueState(v);
    SecureStore.setItemAsync(VENUE_KEY, String(v)).catch(() => {});
  };
  const venueParam = venue === 'all' ? undefined : venue;
  const [exporting, setExporting] = useState(false);
  const q = useQuery({
    queryKey: ['teacher-insights', range, venue],
    queryFn: () => getTeacherInsights({ range, venue: venueParam }),
    // Keep the previous period on screen while the new one loads, so switching periods
    // reads as the numbers changing rather than the page emptying.
    placeholderData: keepPreviousData,
  });
  const d = q.data;
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

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
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('insights.title')}</Text>
        <TouchableOpacity
          onPress={exportPdf}
          disabled={exporting || !d}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: spacing.md, height: 40, borderRadius: 12,
            backgroundColor: colors.brand + '18', opacity: exporting || !d ? 0.5 : 1,
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // alignItems 'center' + a non-shrinking chip: without them RTL measures the
        // Arabic label narrow, wraps it, and the second line is clipped by the chip.
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm, alignItems: 'center' }}
        style={{ flexGrow: 0 }}
      >
        {presets.map((p) => {
          const active = p.key === range;
          return (
            <TouchableOpacity
              key={p.key}
              onPress={() => setRange(p.key)}
              style={{
                flexShrink: 0,
                paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.border,
                backgroundColor: active ? colors.brand : colors.surface,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: active ? '#FFFFFF' : colors.textSecondary }}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Venue filter — every figure below follows it, including the cash block. */}
      {(d?.venues?.length ?? 0) > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm, alignItems: 'center' }} style={{ flexGrow: 0 }}>
          {[
            { key: 'all' as const, label: t('insights.venue_all') },
            ...(d?.venues ?? []).map((v) => ({ key: v.id, label: v.name ?? '' })),
            ...(d?.cash_settings?.per_venue ? [{ key: 'general' as const, label: t('insights.venue_general') }] : []),
          ].map((c) => {
            const active = c.key === venue;
            return (
              <TouchableOpacity key={String(c.key)} onPress={() => setVenue(c.key)}
                style={{ flexShrink: 0, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accent + '22' : colors.surface }}>
                <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, color: active ? colors.accent : colors.textSecondary }}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {q.isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : !d ? (
        <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
          <Icon name="reports" size={40} color={colors.textTertiary} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginTop: spacing.md }}>{t('insights.no_data')}</Text>
        </View>
      ) : (
        <ScrollView
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
