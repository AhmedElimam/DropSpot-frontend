import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { StatsCard } from '@/components/layout/StatsCard';
import { getTeacherInsights, type TeacherInsights, type TrendDay } from '@/api/insights';

/**
 * Full teacher insights screen (pushed from the "الإدارة" hub). Mirrors the web
 * /insights page — attendance, absence, financial, and growth — from the shared
 * TeacherInsightsService via /teacher/insights.
 */
export default function InsightsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ['teacher-insights'], queryFn: getTeacherInsights });
  const d = q.data;

  const money = (v: number) => `${Math.round(v).toLocaleString('en-US')} ${t('insights.egp')}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('insights.title')}</Text>
      </View>

      {q.isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : !d ? (
        <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
          <Icon name="reports" size={40} color={colors.textTertiary} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginTop: spacing.md }}>{t('insights.no_data')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.primary} />}
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
          <TrendBars trend={d.attendance.trend} max={d.attendance.trend_max} label={t('insights.trend_14d')} />
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
            <StatsCard label={t('insights.collected_month')} value={money(d.financial.collected_this_month)} color={colors.success} bgColor={colors.success + '18'} />
            <StatsCard label={t('insights.outstanding')} value={money(d.financial.outstanding)} />
          </Row>
          <Row>
            <StatsCard label={t('insights.overdue')} value={money(d.financial.overdue)} color={colors.danger} bgColor={colors.danger + '18'} />
            <StatsCard label={t('insights.new_students')} value={d.growth.new_students} color={colors.brand} bgColor={colors.brand + '18'} />
          </Row>
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
