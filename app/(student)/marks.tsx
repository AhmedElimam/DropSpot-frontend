import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { getStudentGrades } from '@/api/grades';
import { getStudentExamResults } from '@/api/exams';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatDate } from '@/utils/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';

type TabKey = 'grades' | 'exams';

const cardStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.xl,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.xl,
  ...shadows.sm,
} as const;

// The student's OWN marks — mirrors the parent child-detail grades + exams tabs,
// but scoped to the logged-in student's id (both endpoints authorize self-access).
export default function StudentMarksScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const studentId = useAuthStore((s) => s.user?.student_id) ?? null;
  const [activeTab, setActiveTab] = useState<TabKey>('grades');

  const { data: grades, isLoading: gradesLoading, refetch: refetchGrades } = useQuery({
    queryKey: ['grades', studentId],
    queryFn: () => getStudentGrades(studentId as number),
    enabled: !!studentId,
  });

  const { data: exams, isLoading: examsLoading, refetch: refetchExams } = useQuery({
    queryKey: ['exam-results', studentId],
    queryFn: () => getStudentExamResults(studentId as number),
    enabled: !!studentId,
  });

  const { refreshing, onRefresh } = usePullRefresh(refetchGrades, refetchExams);

  const avgGrade = grades && grades.length > 0
    ? Math.round(grades.reduce((s, g) => s + g.percentage, 0) / grades.length)
    : 0;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'grades', label: t('reports.grades') },
    { key: 'exams', label: t('reports.exam_results') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom, backgroundColor: colors.background, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + insets.top, paddingBottom: spacing.xl4 }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Icon name="forward" size={22} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.8)', marginStart: spacing.sm }}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.white, letterSpacing: -0.5 }}>
            {t('reports.my_marks')}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: spacing.xs }}>
            {t('reports.my_marks_sub')}
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 4 }}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.sm,
                  backgroundColor: activeTab === tab.key ? colors.surface : 'transparent', alignItems: 'center', justifyContent: 'center',
                  ...(activeTab === tab.key ? shadows.sm : {}),
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: activeTab === tab.key ? fonts.bold : fonts.medium, fontSize: 14, color: activeTab === tab.key ? colors.brand : colors.textSecondary, textAlign: 'center' }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'grades' && (
            <View style={cardStyle}>
              <Text style={[textPresets.h3, { marginBottom: spacing.md }]}>{t('reports.grades')}</Text>
              {gradesLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : !grades?.length ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, textAlign: 'center', padding: spacing.xl }}>
                  {t('reports.no_grades')}
                </Text>
              ) : (
                <>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.borderLight, marginBottom: spacing.lg, overflow: 'hidden' }}>
                    <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${avgGrade}%`, height: '100%', borderRadius: 4 }} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 36, color: colors.brand }}>{avgGrade}%</Text>
                    <Text style={[textPresets.bodySmall, { marginStart: spacing.sm }]}>{t('quiz.avg_score')}</Text>
                  </View>
                  {grades.map((g, i) => (
                    <View key={g.id} style={{ paddingVertical: spacing.md, borderBottomWidth: i < grades.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[textPresets.body, { flex: 1 }]}>{g.course_name ?? '—'}</Text>
                        <View style={{ width: 80, height: 6, borderRadius: 3, backgroundColor: colors.borderLight, marginEnd: spacing.md, overflow: 'hidden' }}>
                          <LinearGradient colors={g.percentage >= 90 ? gradients.success : g.percentage >= 75 ? gradients.primary : gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${g.percentage}%`, height: '100%', borderRadius: 3 }} />
                        </View>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: g.percentage >= 90 ? colors.success : g.percentage >= 75 ? colors.brand : colors.warning }}>{g.score ?? 0}</Text>
                        {g.max_score != null ? <Text style={textPresets.caption}>/{g.max_score}</Text> : null}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: spacing.md }}>
                        {g.date ? (
                          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{formatDate(new Date(g.date))}</Text>
                        ) : null}
                        {g.teacher_name ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Icon name="teacher" size={14} color={colors.textSecondary} outline style={{ marginEnd: 2 }} />
                            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{g.teacher_name}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}

          {activeTab === 'exams' && (
            <View style={cardStyle}>
              <Text style={[textPresets.h3, { marginBottom: spacing.md }]}>{t('reports.exam_results')}</Text>
              {examsLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : !exams?.length ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, textAlign: 'center', padding: spacing.xl }}>
                  {t('reports.no_exams')}
                </Text>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {exams.map((e, i) => {
                    const pass = e.pct != null ? e.pct >= 50 : true;
                    return (
                      <View key={i} style={{ paddingVertical: spacing.md, borderBottomWidth: i < exams.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md, backgroundColor: pass ? colors.successLight : colors.dangerLight }}>
                            <Icon name="reports" size={20} color={pass ? colors.success : colors.danger} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[textPresets.body, { fontFamily: fonts.bold }]} numberOfLines={1}>{e.title ?? t('reports.exam_results')}</Text>
                            {e.date ? <Text style={textPresets.caption}>{e.date}</Text> : null}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.brand }}>
                              {e.mark}{e.max ? ` / ${e.max}` : ''}
                            </Text>
                            {e.pct != null ? <Text style={textPresets.caption}>{e.pct}%</Text> : null}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
