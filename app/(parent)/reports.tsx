import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav, gradients } from '@/theme/index';
import { useChildren } from '@/hooks/useChildren';
import { useQuery } from '@tanstack/react-query';
import { getStudentGrades } from '@/api/grades';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/layout/Avatar';

type TabKey = 'attendance' | 'grades';

const rankColors = [colors.accentWarm, colors.inkFaint, '#B45309'];

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
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.white, letterSpacing: -0.5 }}>
            {t('reports.title')}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>
            {children?.length ?? 0} {t('nav.children')}
          </Text>

          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{overallRate}%</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>{t('attendance.attendance_rate')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{overallAvg}%</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>{t('quiz.avg_score')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{totalAbsent}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>{t('attendance.absent')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 4 }}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, minHeight: 48, paddingVertical: spacing.sm, borderRadius: radius.md, justifyContent: 'center',
                  backgroundColor: activeTab === tab.key ? colors.surface : 'transparent', alignItems: 'center',
                  ...(activeTab === tab.key ? shadows.sm : {}),
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: activeTab === tab.key ? colors.brand : colors.textSecondary }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.md }}>
          {activeTab === 'attendance' && (
            <>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadows.sm }}>
                <Text style={textPresets.h3}>{t('attendance.attendance_summary')}</Text>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceSunken, marginTop: spacing.md, marginBottom: spacing.lg, overflow: 'hidden' }}>
                  <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${overallRate}%`, height: '100%', borderRadius: 4 }} />
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
                    style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadows.sm }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Avatar name={child.name} size={44} />
                      <View style={{ marginStart: spacing.md, flex: 1 }}>
                        <Text style={[textPresets.body, { fontFamily: fonts.bold }]}>{child.name}</Text>
                        <Text style={textPresets.caption}>{child.grade}</Text>
                        {child.teachers && child.teachers.length > 0 && (
                          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap' }}>
                            {child.teachers.map((t) => (
                              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Icon name="teacher" size={13} color={colors.textTertiary} outline style={{ marginEnd: 3 }} />
                                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t.name}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: rate >= 90 ? colors.success : rate >= 75 ? colors.brand : colors.warning }}>
                        {rate}%
                      </Text>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceSunken, marginTop: spacing.md, overflow: 'hidden' }}>
                      <LinearGradient colors={rate >= 90 ? gradients.success : rate >= 75 ? gradients.primary : gradients.warm} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${rate}%`, height: '100%', borderRadius: 3 }} />
                    </View>
                    <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.xs }}>
                      <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.successLight, borderRadius: radius.md, paddingVertical: spacing.sm }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.successText }}>{pc}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.successText }}>{t('attendance.present')}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.md, paddingVertical: spacing.sm }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.dangerText }}>{ac}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.dangerText }}>{t('attendance.absent')}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.warningLight, borderRadius: radius.md, paddingVertical: spacing.sm }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.warningText }}>{lc}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.warningText }}>{t('attendance.late')}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.brandTint, borderRadius: radius.md, paddingVertical: spacing.sm }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.brand }}>{ec}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.brand }}>{t('attendance.excused')}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {activeTab === 'grades' && (
            <>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadows.sm }}>
                <Text style={textPresets.h3}>{t('reports.grade_summary')}</Text>
                <View style={{ alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.lg }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 40, color: colors.brand }}>{overallAvg}%</Text>
                  <Text style={textPresets.bodySmall}>{t('quiz.avg_score')}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceSunken, overflow: 'hidden' }}>
                  <LinearGradient colors={overallAvg >= 90 ? gradients.success : gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${overallAvg}%`, height: '100%', borderRadius: 4 }} />
                </View>
              </View>

              {gradeQueries.isLoading ? (
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : sortedByGrade.length > 0 && sortedByGrade.some((c) => (gradeMap[c.student_id]?.count ?? 0) > 0) ? (
                <>
                  {teacherAvgList.length > 0 && (
                    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadows.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon name="trophy" size={20} color={colors.accentWarm} />
                        <Text style={textPresets.h3}>{t('reports.top_teachers')}</Text>
                      </View>
                      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                        {teacherAvgList.slice(0, 3).map((teacher, i) => (
                          <View key={teacher.name} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: rankColors[i], justifyContent: 'center', alignItems: 'center', marginEnd: spacing.sm }}>
                              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{i + 1}</Text>
                            </View>
                            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.sm }}>
                              <Icon name="teacher" size={20} color={colors.brand} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[textPresets.body, { fontFamily: fonts.bold }]}>{teacher.name}</Text>
                              <Text style={textPresets.caption}>{teacher.count} {t('quiz.quizzes')}</Text>
                            </View>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: teacher.avg >= 90 ? colors.success : colors.brand }}>{teacher.avg}%</Text>
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
                        style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadows.sm }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Avatar name={child.name} size={44} />
                          <View style={{ marginStart: spacing.md, flex: 1 }}>
                            <Text style={[textPresets.body, { fontFamily: fonts.bold }]}>{child.name}</Text>
                            <Text style={textPresets.caption}>{child.grade}</Text>
                            {child.teachers && child.teachers.length > 0 && (
                              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap' }}>
                                {child.teachers.map((t) => (
                                  <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Icon name="teacher" size={13} color={colors.textTertiary} outline style={{ marginEnd: 3 }} />
                                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t.name}</Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: avg >= 90 ? colors.success : avg >= 75 ? colors.brand : colors.warning }}>
                              {avg}%
                            </Text>
                            <Text style={textPresets.caption}>{count} {t('quiz.quizzes')}</Text>
                          </View>
                        </View>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceSunken, marginTop: spacing.md, overflow: 'hidden' }}>
                          <LinearGradient colors={avg >= 90 ? gradients.success : gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${avg}%`, height: '100%', borderRadius: 3 }} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : (
                <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xxl, alignItems: 'center', ...shadows.sm, gap: spacing.md }}>
                  <Icon name="grades" size={40} color={colors.textTertiary} outline />
                  <Text style={{ fontFamily: fonts.regular, fontSize: 17, color: colors.textSecondary, textAlign: 'center' }}>
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
