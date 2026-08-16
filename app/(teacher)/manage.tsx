import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StatsCard } from '@/components/layout/StatsCard';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { getTeacherInsights } from '@/api/insights';

/**
 * "الإدارة" tab — the hub for course & schedule management (the web-dashboard
 * parity surface). Course CREATION stays on the web; here the teacher manages
 * existing courses (settings, GPS location, slots) and runs schedule tools.
 */
export default function TeacherManage() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { can, isAssistant } = useActiveAbilities();
  const { data: flags } = useFeatureFlags();

  const canCourses = can(ABILITY.MANAGE_COURSES);
  const canSessions = can(ABILITY.MANAGE_SESSIONS);
  const ramadanOn = !!flags?.ramadan_schedule;
  const insights = useQuery({ queryKey: ['teacher-insights'], queryFn: getTeacherInsights });
  const ins = insights.data;
  const money = (v: number) => `${Math.round(v).toLocaleString('en-US')} ${t('insights.egp')}`;

  const Row = ({ icon, title, sub, onPress, tint }: { icon: IconName; title: string; sub: string; onPress: () => void; tint?: string }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.sm }}
    >
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: (tint ?? colors.brand) + '18', justifyContent: 'center', alignItems: 'center' }}>
        <Icon name={icon} size={22} color={tint ?? colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{sub}</Text>
      </View>
      <Icon name="back" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  const SectionTitle = ({ children }: { children: string }) => (
    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.lg, marginBottom: spacing.sm }}>{children}</Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary }}>{t('teacher.tab_manage')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom }}>
        {/* Mini insights — a compact glance, tap through to the full screen. */}
        <SectionTitle>{t('teacher.insights_title')}</SectionTitle>
        {ins ? (
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(teacher)/insights' as Href)}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
              <StatsCard label={t('insights.attendance_rate')} value={`${ins.attendance.rate}%`} color={colors.success} bgColor={colors.success + '18'} />
              <StatsCard label={t('insights.at_risk')} value={ins.absence.at_risk} color={colors.warning} bgColor={colors.warning + '18'} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
              <StatsCard label={t('insights.collected_month')} value={money(ins.financial.collected_this_month)} />
              <StatsCard label={t('insights.new_students')} value={ins.growth.new_students} color={colors.brand} bgColor={colors.brand + '18'} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.view_all_insights')}</Text>
              <Icon name="back" size={16} color={colors.brand} />
            </View>
          </TouchableOpacity>
        ) : (
          <Row icon="reports" title={t('teacher.insights_title')} sub={t('teacher.insights_sub')} onPress={() => router.push('/(teacher)/insights' as Href)} />
        )}

        <SectionTitle>{t('teacher.resolution_title')}</SectionTitle>
        <Row icon="bell" title={t('teacher.resolution_title')} sub={t('teacher.resolution_sub')} tint={colors.warning} onPress={() => router.push('/(teacher)/resolution' as Href)} />

        {/* Special / exam sessions — run + enter marks (creation is on web). */}
        {flags?.revision_kiosk ? (
          <Row icon="reports" title={t('teacher.special_sessions_title')} sub={t('teacher.special_sessions_sub')} tint={colors.brand} onPress={() => router.push('/(teacher)/revisions' as Href)} />
        ) : null}

        <SectionTitle>{t('teacher.courses_title')}</SectionTitle>
        <Row icon="book" title={t('teacher.courses_title')} sub={t('teacher.courses_manage_hint')} onPress={() => router.push('/(teacher)/courses' as Href)} />
        {!isAssistant ? (
          <Row icon="add" title={t('teacher.create_course')} sub={t('teacher.create_course_sub')} onPress={() => router.push('/(teacher)/courses/create' as Href)} />
        ) : null}

        {canSessions || canCourses ? (
          <>
            <SectionTitle>{t('teacher.schedule_tools')}</SectionTitle>
            {canSessions ? (
              <Row icon="add" title={t('teacher.add_schedule')} sub={t('teacher.add_slot_sub')} onPress={() => router.push('/(teacher)/schedule-new' as Href)} />
            ) : null}
            {canSessions ? (
              <Row icon="clock" title={t('teacher.pause_period')} sub={t('teacher.pause_sub')} tint={colors.warning} onPress={() => router.push('/(teacher)/pause' as Href)} />
            ) : null}
            {canCourses ? (
              <Row icon="calendar" title={t('teacher.merge_title')} sub={t('teacher.merge_sub')} onPress={() => router.push('/(teacher)/schedule-merge' as Href)} />
            ) : null}
            {canCourses && ramadanOn ? (
              <Row icon="clock" title={t('teacher.overrides_title')} sub={t('teacher.overrides_sub')} tint={colors.info} onPress={() => router.push('/(teacher)/schedule-overrides' as Href)} />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
