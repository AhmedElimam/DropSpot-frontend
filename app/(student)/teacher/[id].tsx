import { useState } from 'react';
import { View, Text, RefreshControl, ActivityIndicator } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useMyComplaints } from '@/hooks/useComplaints';
import { getStudentTeacherDetail } from '@/api/studentOverview';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatDate, formatNumber, formatTime } from '@/utils/format';
import { Icon } from '@/components/ui/Icon';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead } from '@/components/ui/SectionHead';
import { EmptyState } from '@/components/ui/EmptyState';
import { avatarSeed } from '@/components/ui/GeneratedAvatar';
import { AttendanceOverview } from '@/components/attendance/AttendanceOverview';
import { AttendanceRecordList } from '@/components/attendance/AttendanceRecordList';
import { ComplaintSheet, type ComplaintTarget } from '@/components/student/ComplaintSheet';
import type { AttendanceRecord } from '@/types/attendance';

/**
 * One teacher, from the student's side (founder 2026-10-03: «click to see more details on
 * that page of sessions and exams»): their logo or character, the courses the student
 * attends under them with standing, the next sessions, the sheet marks with their average,
 * the exam results, and the attendance record under this teacher with «اعتراض» on each row.
 */
export default function StudentTeacherPage() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const teacherId = Number(id);
  const studentId = useAuthStore((s) => s.user?.student_id ?? null);
  const q = useQuery({
    queryKey: ['student-teacher-detail', studentId, teacherId],
    queryFn: () => getStudentTeacherDetail(studentId as number, teacherId),
    enabled: !!studentId && Number.isFinite(teacherId),
  });
  const complaints = useMyComplaints();
  const { refreshing, onRefresh } = usePullRefresh(q.refetch, complaints.refetch);
  const [complaintTarget, setComplaintTarget] = useState<ComplaintTarget | null>(null);
  const d = q.data;

  const rate = d && d.total > 0 ? Math.round((d.present / d.total) * 100) : null;
  const toneOf = (r: number | null) => r === null ? colors.textTertiary : r >= 90 ? colors.success : r >= 75 ? colors.brand : colors.accent;
  const past: AttendanceRecord[] = (d?.past ?? []).map((p) => ({
    ...p,
    course_name: p.course_name ?? undefined,
    session_time: p.session_time ?? undefined,
    teacher_name: p.teacher_name ?? undefined,
    latitude: null,
    longitude: null,
  }));

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!d) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <PageHero title={t('student_teacher.title')} onBack compact />
        <EmptyState icon="teacher" title={t('student_teacher.not_found')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom, backgroundColor: colors.background, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <PageHero
          title={d.name}
          subtitle={d.courses.map((c) => c.name).join(' · ')}
          avatar={avatarSeed.user(d.id, d.name)}
          avatarUrl={d.logo_url}
          onBack
          stats={[
            { value: rate === null ? '—' : `${formatNumber(rate)}%`, label: t('attendance.attendance_rate') },
            { value: formatNumber(d.total), label: t('student_teacher.sessions_count') },
            { value: formatNumber(d.exams.length), label: t('student_teacher.exams_count') },
          ]}
        />

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4, gap: spacing.md }}>
          {/* Standing under this teacher, course by course. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <AttendanceOverview present={d.present} absent={d.absent} excused={d.excused} ringSize={96} />
            <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md }} />
            <SectionHead icon="sessions" color={colors.brand} title={t('student_teacher.courses')} />
            <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
              {d.courses.map((c) => {
                const tone = toneOf(c.rate);
                return (
                  <View key={c.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.textPrimary }} numberOfLines={1}>{c.name}</Text>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: tone }}>{c.total > 0 ? `${formatNumber(c.present)}/${formatNumber(c.total)}` : '—'}</Text>
                    </View>
                    <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.borderLight, overflow: 'hidden', marginTop: 5 }}>
                      <View style={{ width: `${c.rate ?? 0}%`, height: '100%', borderRadius: 4, backgroundColor: tone }} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Next sessions. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <SectionHead icon="calendar" color={colors.brand} title={t('student_teacher.upcoming')} />
            {d.upcoming.length === 0 ? (
              <Text style={[textPresets.bodySmall, { color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg }]}>{t('student_teacher.no_upcoming')}</Text>
            ) : d.upcoming.map((s, i) => {
              const when = s.scheduled_at ? new Date(s.scheduled_at) : null;
              const ok = when && !isNaN(when.getTime());
              return (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: i < d.upcoming.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: s.type === 'quiz_exam' ? colors.accentLight : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: s.type === 'quiz_exam' ? colors.accent : colors.brand, includeFontPadding: false }}>{ok ? formatDate(when, { day: 'numeric' }) : '—'}</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 10, lineHeight: 13, color: s.type === 'quiz_exam' ? colors.accent : colors.brand }} numberOfLines={1} adjustsFontSizeToFit>{ok ? formatDate(when, { month: 'short' }) : ''}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }} numberOfLines={1}>
                      {s.type === 'quiz_exam' ? `${t('student_teacher.exam_label')} · ` : ''}{s.course_name ?? '—'}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                      {[ok ? formatDate(when, { weekday: 'long' }) : null, ok ? formatTime(when) : null, t('student_teacher.minutes', { n: formatNumber(s.duration_minutes) }), s.location].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Sheet marks with their average. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionHead icon="grades" color={colors.brand} title={t('student_teacher.marks')} />
              {d.marks_average !== null ? (
                <View style={{ alignItems: 'center', backgroundColor: `${toneOf(d.marks_average)}1A`, borderRadius: radius.md, paddingVertical: 4, paddingHorizontal: spacing.sm, minWidth: 60 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: toneOf(d.marks_average) }}>{formatNumber(d.marks_average)}%</Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: toneOf(d.marks_average) }}>{t('student_teacher.marks_avg')}</Text>
                </View>
              ) : null}
            </View>
            {d.marks.length === 0 ? (
              <Text style={[textPresets.bodySmall, { color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg }]}>{t('student_teacher.no_marks')}</Text>
            ) : d.marks.slice(0, 12).map((m, i) => {
              const tone = toneOf(Math.round(m.percentage));
              return (
                <View key={m.id} style={{ paddingVertical: spacing.sm, borderBottomWidth: i < Math.min(d.marks.length, 12) - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.textPrimary }} numberOfLines={1}>
                      {m.date ? formatDate(new Date(m.date), { day: 'numeric', month: 'short' }) : '—'} · {m.course_name ?? ''}
                    </Text>
                    <View style={{ width: 72, height: 6, borderRadius: 3, backgroundColor: colors.borderLight, overflow: 'hidden' }}>
                      <View style={{ width: `${Math.min(100, m.percentage)}%`, height: '100%', borderRadius: 3, backgroundColor: tone }} />
                    </View>
                    <Text style={{ width: 54, textAlign: 'left', fontFamily: fonts.bold, fontSize: 13, color: tone }}>
                      {formatNumber(m.score)}{m.max_score != null ? `/${formatNumber(m.max_score)}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Exam results. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <SectionHead icon="reports" color={colors.accent} title={t('student_teacher.exams')} />
            {d.exams.length === 0 ? (
              <Text style={[textPresets.bodySmall, { color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg }]}>{t('student_teacher.no_exams')}</Text>
            ) : d.exams.map((e, i) => {
              const pass = e.pct != null ? e.pct >= 50 : true;
              return (
                <View key={`${e.date}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: i < d.exams.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: pass ? colors.successLight : colors.dangerLight }}>
                    <Icon name="reports" size={20} color={pass ? colors.success : colors.danger} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }} numberOfLines={1}>{e.title}</Text>
                    {e.date ? <Text style={textPresets.caption}>{formatDate(new Date(e.date), { weekday: 'long', day: 'numeric', month: 'short' })}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: pass ? colors.success : colors.danger }}>
                      {formatNumber(e.mark)}{e.max ? ` / ${formatNumber(e.max)}` : ''}
                    </Text>
                    {e.pct != null ? <Text style={textPresets.caption}>{formatNumber(e.pct)}%</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>

          {/* The attendance record under this teacher. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <SectionHead icon="attendance" color={colors.success} title={t('student_teacher.past')} />
            <AttendanceRecordList
              records={past}
              complaintsBySession={complaints.bySession}
              onComplain={(r) => setComplaintTarget({ type: 'attendance', sessionInstanceId: r.session_instance_id, courseName: r.course_name ?? '', sessionAt: r.session_time ?? null, recordedStatus: r.status ?? null })}
              limit={8}
            />
          </View>
        </View>
      </ScrollView>

      <ComplaintSheet visible={!!complaintTarget} onClose={() => setComplaintTarget(null)} target={complaintTarget} />
    </View>
  );
}
