import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav } from '@/theme/index';
import { useChildren } from '@/hooks/useChildren';
import { useQuery } from '@tanstack/react-query';
import { getStudentGrades } from '@/api/grades';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';

type TabKey = 'attendance' | 'grades';

const rankColors = ['#F59E0B', '#94A3B8', '#B45309'];

export default function ReportsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>('attendance');
  const { data: children, isLoading } = useChildren();

  const sortedByAttendance = useMemo(() =>
    [...(children ?? [])].sort((a, b) => (b.attendance_rate ?? 0) - (a.attendance_rate ?? 0)),
    [children],
  );

  const totalPresent = (children ?? []).reduce((s, c) => s + (c.present_count ?? 0), 0);
  const totalAbsent = (children ?? []).reduce((s, c) => s + (c.absent_count ?? 0), 0);
  const totalLate = (children ?? []).reduce((s, c) => s + (c.late_count ?? 0), 0);
  const totalExcused = (children ?? []).reduce((s, c) => s + (c.excused_count ?? 0), 0);
  const totalAll = totalPresent + totalAbsent + totalLate + totalExcused;
  const overallRate = totalAll > 0 ? Math.round((totalPresent / totalAll) * 100) : 0;

  const gradeQueries = useQuery({
    queryKey: ['reports', 'grades', 'all', (children ?? []).map((c) => c.student_id)],
    queryFn: async () => {
      const results = await Promise.allSettled(
        (children ?? []).map(async (child) => {
          const grades = await getStudentGrades(child.student_id);
          return { studentId: child.student_id, grades };
        }),
      );
      const allGrades: { studentId: number; grades: import('@/types/grade-record').GradeRecord[] }[] = [];
      results.forEach((r) => {
        if (r.status === 'fulfilled') allGrades.push(r.value);
      });
      return allGrades;
    },
    enabled: (children ?? []).length > 0,
  });

  const allGradeData = gradeQueries.data ?? [];
  const gradeMap: Record<number, { avg: number; count: number }> = {};
  const teacherScores: Record<string, { total: number; count: number }> = {};
  allGradeData.forEach(({ studentId, grades }) => {
    const avg = grades.length > 0
      ? Math.round(grades.reduce((s, g) => s + g.percentage, 0) / grades.length)
      : 0;
    gradeMap[studentId] = { avg, count: grades.length };
    grades.forEach((g) => {
      if (g.teacher_name) {
        if (!teacherScores[g.teacher_name]) teacherScores[g.teacher_name] = { total: 0, count: 0 };
        teacherScores[g.teacher_name].total += g.percentage;
        teacherScores[g.teacher_name].count += 1;
      }
    });
  });
  const teacherAvgList = useMemo(() =>
    Object.entries(teacherScores)
      .map(([name, val]) => ({ name, avg: Math.round(val.total / val.count), count: val.count }))
      .sort((a, b) => b.avg - a.avg),
    [gradeQueries.data],
  );

  const sortedByGrade = useMemo(() =>
    [...(children ?? [])].sort((a, b) => {
      const ga = gradeMap[a.student_id]?.avg ?? 0;
      const gb = gradeMap[b.student_id]?.avg ?? 0;
      return gb - ga;
    }),
    [children, gradeMap],
  );
  const overallAvg = (children ?? []).length > 0
    ? Math.round((children ?? []).reduce((s, c) => s + (gradeMap[c.student_id]?.avg ?? 0), 0) / (children ?? []).length)
    : 0;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'attendance', label: t('reports.attendance') },
    { key: 'grades', label: t('reports.grades') },
  ];

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#1E1B4B', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.white, letterSpacing: -0.5 }}>
            {t('reports.title')}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
            {children?.length ?? 0} {t('nav.children')}
          </Text>

          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{overallRate}%</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{t('attendance.attendance_rate')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{overallAvg}%</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{t('quiz.avg_score')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{totalAbsent}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{t('attendance.absent')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.borderLight, borderRadius: radius.md, padding: 3 }}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md - 2,
                  backgroundColor: activeTab === tab.key ? colors.white : 'transparent', alignItems: 'center',
                  ...(activeTab === tab.key ? shadows.sm : {}),
                }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: activeTab === tab.key ? colors.primary : colors.textSecondary }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.md }}>
          {activeTab === 'attendance' && (
            <>
              <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
                <Text style={textPresets.h3}>{t('attendance.attendance_summary')}</Text>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.borderLight, marginTop: spacing.md, marginBottom: spacing.lg, overflow: 'hidden' }}>
                  <LinearGradient colors={['#6366F1', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${overallRate}%`, height: '100%', borderRadius: 4 }} />
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.sm }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.success }}>{totalPresent}</Text>
                    <Text style={textPresets.caption}>{t('attendance.present')}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.sm }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.danger }}>{totalAbsent}</Text>
                    <Text style={textPresets.caption}>{t('attendance.absent')}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.sm }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.warning }}>{totalLate}</Text>
                    <Text style={textPresets.caption}>{t('attendance.late')}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.sm }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.primary }}>{totalExcused}</Text>
                    <Text style={textPresets.caption}>{t('attendance.excused')}</Text>
                  </View>
                </View>
              </View>

              {sortedByAttendance.map((child) => {
                const rate = child.attendance_rate ?? 0;
                const pc = child.present_count ?? 0;
                const ac = child.absent_count ?? 0;
                const lc = child.late_count ?? 0;
                const ec = child.excused_count ?? 0;
                return (
                  <TouchableOpacity
                    key={child.id}
                    onPress={() => router.push(`/(parent)/child/${child.id}`)}
                    activeOpacity={0.7}
                    style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <LinearGradient colors={['#6366F1', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, color: '#fff' }}>{(child.name || '?')[0]}</Text>
                      </LinearGradient>
                      <View style={{ marginStart: spacing.md, flex: 1 }}>
                        <Text style={[textPresets.body, { fontFamily: fonts.medium }]}>{child.name}</Text>
                        <Text style={textPresets.caption}>{child.grade}</Text>
                        {child.teachers && child.teachers.length > 0 && (
                          <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: 2, flexWrap: 'wrap' }}>
                            {child.teachers.map((t) => (
                              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Icon name="teacher" size={12} color={colors.textTertiary} outline style={{ marginEnd: 2 }} />
                                <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary }}>{t.name}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: rate >= 90 ? colors.success : rate >= 75 ? colors.primary : colors.warning }}>
                        {rate}%
                      </Text>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.borderLight, marginTop: spacing.md, overflow: 'hidden' }}>
                      <LinearGradient colors={rate >= 90 ? ['#10B981', '#059669'] : rate >= 75 ? ['#6366F1', '#8B5CF6'] : ['#F59E0B', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${rate}%`, height: '100%', borderRadius: 3 }} />
                    </View>
                    <View style={{ flexDirection: 'row', marginTop: spacing.sm, gap: spacing.xs }}>
                      <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.successLight, borderRadius: radius.sm, paddingVertical: 3 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.success }}>{pc}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: colors.success }}>{t('attendance.present')}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.sm, paddingVertical: 3 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.danger }}>{ac}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: colors.danger }}>{t('attendance.absent')}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.warningLight, borderRadius: radius.sm, paddingVertical: 3 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.warning }}>{lc}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: colors.warning }}>{t('attendance.late')}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingVertical: 3 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>{ec}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: colors.primary }}>{t('attendance.excused')}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {activeTab === 'grades' && (
            <>
              <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
                <Text style={textPresets.h3}>{t('reports.grade_summary')}</Text>
                <View style={{ alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.lg }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 40, color: colors.primary }}>{overallAvg}%</Text>
                  <Text style={textPresets.bodySmall}>{t('quiz.avg_score')}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.borderLight, overflow: 'hidden' }}>
                  <LinearGradient colors={overallAvg >= 90 ? ['#10B981', '#059669'] : ['#6366F1', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${overallAvg}%`, height: '100%', borderRadius: 4 }} />
                </View>
              </View>

              {gradeQueries.isLoading ? (
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : sortedByGrade.length > 0 && sortedByGrade.some((c) => (gradeMap[c.student_id]?.count ?? 0) > 0) ? (
                <>
                  {teacherAvgList.length > 0 && (
                    <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon name="trophy" size={20} color={colors.warning} />
                        <Text style={textPresets.h3}>{t('reports.top_teachers')}</Text>
                      </View>
                      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                        {teacherAvgList.slice(0, 3).map((teacher, i) => (
                          <View key={teacher.name} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: rankColors[i], justifyContent: 'center', alignItems: 'center', marginEnd: spacing.sm }}>
                              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{i + 1}</Text>
                            </View>
                            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.sm }}>
                              <Icon name="teacher" size={18} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[textPresets.body, { fontFamily: fonts.medium }]}>{teacher.name}</Text>
                              <Text style={textPresets.caption}>{teacher.count} {t('quiz.quizzes')}</Text>
                            </View>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: teacher.avg >= 90 ? colors.success : colors.primary }}>{teacher.avg}%</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {sortedByGrade.map((child) => {
                    const avg = gradeMap[child.student_id]?.avg ?? 0;
                    const count = gradeMap[child.student_id]?.count ?? 0;
                    return (
                      <TouchableOpacity
                        key={child.id}
                        onPress={() => router.push(`/(parent)/child/${child.id}`)}
                        activeOpacity={0.7}
                        style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ fontSize: 18, color: '#fff' }}>{(child.name || '?')[0]}</Text>
                          </LinearGradient>
                          <View style={{ marginStart: spacing.md, flex: 1 }}>
                            <Text style={[textPresets.body, { fontFamily: fonts.medium }]}>{child.name}</Text>
                            <Text style={textPresets.caption}>{child.grade}</Text>
                            {child.teachers && child.teachers.length > 0 && (
                              <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: 2, flexWrap: 'wrap' }}>
                                {child.teachers.map((t) => (
                                  <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Icon name="teacher" size={12} color={colors.textTertiary} outline style={{ marginEnd: 2 }} />
                                    <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary }}>{t.name}</Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: avg >= 90 ? colors.success : avg >= 75 ? colors.primary : colors.warning }}>
                              {avg}%
                            </Text>
                            <Text style={textPresets.caption}>{count} {t('quiz.quizzes')}</Text>
                          </View>
                        </View>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.borderLight, marginTop: spacing.md, overflow: 'hidden' }}>
                          <LinearGradient colors={avg >= 90 ? ['#10B981', '#059669'] : ['#6366F1', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${avg}%`, height: '100%', borderRadius: 3 }} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : (
                <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xxl, alignItems: 'center', ...shadows.md, gap: spacing.md }}>
                  <Icon name="grades" size={40} color={colors.textTertiary} outline />
                  <Text style={{ fontFamily: fonts.regular, fontSize: 16, color: colors.textSecondary, textAlign: 'center' }}>
                    {t('common.no_data')}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
