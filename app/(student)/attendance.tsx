import { useState } from 'react';
import { View, Text, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useAttendanceRecords, useCoverageStats } from '@/hooks/useAttendance';
import { useMyComplaints } from '@/hooks/useComplaints';
import { getStudentTeachers } from '@/api/studentOverview';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatDate, formatNumber } from '@/utils/format';
import { Icon } from '@/components/ui/Icon';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead } from '@/components/ui/SectionHead';
import { AttendanceOverview } from '@/components/attendance/AttendanceOverview';
import { AttendanceRecordList } from '@/components/attendance/AttendanceRecordList';
import { ComplaintSheet, type ComplaintTarget } from '@/components/student/ComplaintSheet';

/**
 * The student's full attendance record (founder 2026-10-03: «on check-in percentage I want
 * to see details on click»): the rate as a ring, then course by course under each teacher,
 * then every recorded session grouped by month with filters — and «اعتراض» on each row.
 */
export default function StudentAttendanceDetail() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const studentId = useAuthStore((s) => s.user?.student_id ?? null);
  const { data: stats, refetch: refetchStats, isLoading: statsLoading } = useCoverageStats();
  const { data: records, refetch: refetchRecords, isLoading: recordsLoading } = useAttendanceRecords();
  const teachersQ = useQuery({ queryKey: ['student-teachers', studentId], queryFn: () => getStudentTeachers(studentId as number), enabled: !!studentId });
  const complaints = useMyComplaints();
  const { refreshing, onRefresh } = usePullRefresh(refetchStats, refetchRecords, teachersQ.refetch, complaints.refetch);
  const [complaintTarget, setComplaintTarget] = useState<ComplaintTarget | null>(null);

  const attended = (stats?.present ?? 0) + (stats?.late ?? 0);
  const total = attended + (stats?.absent ?? 0) + (stats?.excused ?? 0);
  const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
  const toneOf = (rate: number | null) => rate === null ? colors.textTertiary : rate >= 90 ? colors.success : rate >= 75 ? colors.brand : colors.accent;

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom, backgroundColor: colors.background, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <PageHero
          title={t('attendance.detail_title')}
          subtitle={t('attendance.detail_sub')}
          onBack
          stats={[
            { value: `${formatNumber(pct)}%`, label: t('attendance.attendance_rate') },
            { value: formatNumber(attended), label: t('attendance.present') },
            { value: formatNumber(stats?.absent ?? 0), label: t('attendance.absent'), warn: (stats?.absent ?? 0) > 0 },
          ]}
        />

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4, gap: spacing.md }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            {statsLoading ? <ActivityIndicator color={colors.primary} /> : (
              <AttendanceOverview present={stats?.present ?? 0} late={stats?.late ?? 0} absent={stats?.absent ?? 0} excused={stats?.excused ?? 0} ringSize={112} />
            )}
          </View>

          {/* Course by course, under each teacher — tap a teacher to open their page. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <SectionHead icon="teacher" color={colors.brand} title={t('attendance.by_course')} />
            {teachersQ.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.lg }} />
            ) : (teachersQ.data ?? []).length === 0 ? (
              <Text style={[textPresets.bodySmall, { color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg }]}>{t('home.no_teachers')}</Text>
            ) : (teachersQ.data ?? []).map((teacher, ti) => (
              <View key={teacher.id} style={{ marginTop: spacing.md, paddingTop: ti === 0 ? 0 : spacing.md, borderTopWidth: ti === 0 ? 0 : 1, borderTopColor: colors.borderLight }}>
                <TouchableOpacity onPress={() => router.push(`/(student)/teacher/${teacher.id}`)} activeOpacity={0.8} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{teacher.name}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('attendance.tap_for_detail')}</Text>
                  <Icon name="back" size={13} color={colors.brand} />
                </TouchableOpacity>
                {teacher.courses.map((c) => {
                  const tone = toneOf(c.rate);
                  return (
                    <View key={c.id} style={{ marginBottom: spacing.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.textPrimary }} numberOfLines={1}>{c.name}</Text>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: tone }}>{c.rate === null ? '—' : `${formatNumber(c.rate)}%`}</Text>
                      </View>
                      <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.borderLight, overflow: 'hidden', marginTop: 5 }}>
                        <View style={{ width: `${c.rate ?? 0}%`, height: '100%', borderRadius: 4, backgroundColor: tone }} />
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 4 }}>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.successText }}>{t('attendance.present')} {formatNumber(c.present)}</Text>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.infoText }}>{t('attendance.excused')} {formatNumber(c.excused)}</Text>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.dangerText }}>{t('attendance.absent')} {formatNumber(c.absent)}</Text>
                        {c.next_session_at ? (
                          <Text style={{ flex: 1, textAlign: 'left', fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }} numberOfLines={1}>
                            {t('home.next_session_short', { when: formatDate(new Date(c.next_session_at), { weekday: 'long', day: 'numeric', month: 'short' }) })}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Every recorded session, filterable, month by month. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <SectionHead icon="calendar" color={colors.brand} title={t('attendance.history_title')} />
            <Text style={[textPresets.bodySmall, { marginTop: 2 }]}>{t('attendance.history_sub')}</Text>
            {recordsLoading ? <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.lg }} /> : (
              <AttendanceRecordList
                records={records ?? []}
                complaintsBySession={complaints.bySession}
                onComplain={(r) => setComplaintTarget({ type: 'attendance', sessionInstanceId: r.session_instance_id, courseName: r.course_name ?? '', sessionAt: r.session_time ?? null, recordedStatus: r.status ?? null })}
                limit={10}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <ComplaintSheet visible={!!complaintTarget} onClose={() => setComplaintTarget(null)} target={complaintTarget} />
    </View>
  );
}
