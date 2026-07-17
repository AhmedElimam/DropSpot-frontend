import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, FlatList, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav, gradients } from '@/theme/index';
import { useChildren } from '@/hooks/useChildren';
import { getStudentCoverage, getAttendanceRecords } from '@/api/attendance';
import { getStudentGrades } from '@/api/grades';
import { getQuizzes } from '@/api/quizzes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/layout/Avatar';
import { Icon } from '@/components/ui/Icon';

type TabKey = 'attendance' | 'grades' | 'quizzes' | 'settings';

const cardStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.xxl,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.xl,
  ...shadows.sm,
} as const;

export default function ChildDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const { data: children, isLoading: childrenLoading } = useChildren();
  const [activeTab, setActiveTab] = useState<TabKey>('attendance');
  const [showPicker, setShowPicker] = useState(false);

  const selectedIndex = Math.max(0, (children ?? []).findIndex((c) => c.id === params.id));
  const child = (children ?? [])[selectedIndex];

  const { data: coverage, isLoading: coverageLoading } = useQuery({
    queryKey: ['attendance', 'stats', child?.student_id],
    queryFn: () => getStudentCoverage(child!.student_id),
    enabled: !!child,
  });

  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ['grades', child?.student_id],
    queryFn: () => getStudentGrades(child!.student_id),
    enabled: !!child,
  });

  const { data: quizzes, isLoading: quizzesLoading } = useQuery({
    queryKey: ['quizzes', child?.student_id],
    queryFn: () => getQuizzes(child!.student_id),
    enabled: !!child,
  });

  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ['attendance', 'records', child?.student_id],
    queryFn: () => getAttendanceRecords(child!.student_id),
    enabled: !!child,
  });

  const present = coverage?.present ?? 0;
  const absent = coverage?.absent ?? 0;
  const excused = coverage?.excused ?? 0;
  const total = present + absent + excused;
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
  const avgGrade = grades && grades.length > 0
    ? Math.round(grades.reduce((s, g) => s + g.percentage, 0) / grades.length)
    : 0;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'attendance', label: t('reports.attendance') },
    { key: 'grades', label: t('reports.grades') },
    { key: 'quizzes', label: t('quiz.quizzes') },
    { key: 'settings', label: t('nav.settings') },
  ];

  if (childrenLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!child) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState
          icon="search"
          title={t('common.not_found')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
        />
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
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + insets.top, paddingBottom: spacing.xl4 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="forward" size={22} color="rgba(255,255,255,0.8)" />
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.8)', marginStart: spacing.sm }}>{t('common.back')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: '#fff' }}>{child.name}</Text>
              <Icon name="down" size={14} color="rgba(255,255,255,0.7)" style={{ marginStart: 6 }} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{ width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', marginEnd: spacing.md }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{(child.name || '?')[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{child.name}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>
                {child.grade ?? ''}{child.student_code ? ` · ${child.student_code}` : ''}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{attendanceRate}%</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{t('attendance.attendance_rate')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{avgGrade}%</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{t('quiz.avg_score')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{absent}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{t('attendance.absent')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 4 }}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: radius.sm,
                  backgroundColor: activeTab === tab.key ? colors.surface : 'transparent', alignItems: 'center',
                  ...(activeTab === tab.key ? shadows.sm : {}),
                }}
              >
                <Text style={{ fontFamily: activeTab === tab.key ? fonts.bold : fonts.medium, fontSize: 15, color: activeTab === tab.key ? colors.brand : colors.textSecondary }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.md }}>
          {activeTab === 'attendance' && (
            <>
              <View style={cardStyle}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                  <Text style={textPresets.h3}>{t('attendance.attendance_summary')}</Text>
                </View>
                {coverageLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
                      <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.md }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.success }}>{present}</Text>
                        <Text style={[textPresets.caption, { fontSize: 13 }]}>{t('attendance.present')}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.danger }}>{absent}</Text>
                        <Text style={[textPresets.caption, { fontSize: 13 }]}>{t('attendance.absent')}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.infoLight, borderRadius: radius.md, padding: spacing.md }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.infoText }}>{excused}</Text>
                        <Text style={[textPresets.caption, { fontSize: 13 }]}>{t('attendance.excused')}</Text>
                      </View>
                    </View>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.borderLight, marginBottom: spacing.lg, overflow: 'hidden' }}>
                      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${attendanceRate}%`, height: '100%', borderRadius: 4 }} />
                    </View>
                  </>
                )}
                <Text style={[textPresets.bodySmall, { marginBottom: spacing.sm }]}>{t('session.your_sessions')}</Text>
                {recordsLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : !records?.length ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, textAlign: 'center', padding: spacing.md }}>
                    {t('common.no_data')}
                  </Text>
                ) : (
                  records.slice(0, 10).map((s, i) => (
                    <View key={s.id} style={{ paddingVertical: spacing.md, borderBottomWidth: i < Math.min(records.length, 10) - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={textPresets.body}>{s.course_name ?? `#${s.session_instance_id}`}</Text>
                          <Text style={textPresets.caption}>{s.session_time ?? ''}</Text>
                          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap' }}>
                            {s.teacher_name && (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Icon name="teacher" size={14} color={colors.textSecondary} outline style={{ marginEnd: 2 }} />
                                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{s.teacher_name}</Text>
                              </View>
                            )}
                            {s.location && (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Icon name="location" size={14} color={colors.textSecondary} outline style={{ marginEnd: 2 }} />
                                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{s.location}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <StatusBadge status={s.status} />
                          {/* How the day was recorded — transparency for parents
                              (card scan is primary; phone/manual are the exceptions). */}
                          {s.check_in_method && (s.status === 'present' || s.status === 'late') ? (
                            <StatusBadge status={s.check_in_method} size="sm" />
                          ) : null}
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          )}

          {activeTab === 'grades' && (
            <>
              <View style={cardStyle}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                  <Text style={textPresets.h3}>{t('reports.grades')}</Text>
                </View>
                {gradesLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : !grades?.length ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, textAlign: 'center', padding: spacing.md }}>
                    {t('common.no_data')}
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
                          <Text style={[textPresets.body, { flex: 1 }]}>{g.course_name ?? g.quiz_title ?? `Quiz #${g.quiz_id}`}</Text>
                          <View style={{ width: 80, height: 6, borderRadius: 3, backgroundColor: colors.borderLight, marginEnd: spacing.md, overflow: 'hidden' }}>
                            <LinearGradient colors={g.percentage >= 90 ? gradients.success : g.percentage >= 75 ? gradients.primary : gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${g.percentage}%`, height: '100%', borderRadius: 3 }} />
                          </View>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: g.percentage >= 90 ? colors.success : g.percentage >= 75 ? colors.brand : colors.warning }}>{g.score ?? 0}</Text>
                          <Text style={textPresets.caption}>/{g.max_score}</Text>
                        </View>
                        {g.teacher_name && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <Icon name="teacher" size={14} color={colors.textSecondary} outline style={{ marginEnd: 2 }} />
                            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{g.teacher_name}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </>
                )}
              </View>
            </>
          )}

          {activeTab === 'quizzes' && (
            <>
              <View style={cardStyle}>
                <Text style={textPresets.h3}>{t('quiz.quizzes')}</Text>
                {quizzesLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.md }} />
                ) : !quizzes?.length ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, textAlign: 'center', padding: spacing.xl }}>
                    {t('quiz.no_quizzes')}
                  </Text>
                ) : (
                  <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                    {quizzes.map((q) => {
                      const now = new Date();
                      const ended = q.ends_at ? new Date(q.ends_at) < now : false;
                      const isPending = q.is_active && !ended;

                      return (
                        <View key={q.id} style={{ paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View
                              style={{ width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md, backgroundColor: isPending ? colors.brandTint : colors.successLight }}
                            >
                              <Icon name={isPending ? 'quiz' : 'success'} size={20} color={isPending ? colors.brand : colors.success} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[textPresets.body, { fontFamily: fonts.bold }]}>{q.title}</Text>
                              <Text style={textPresets.caption}>{q.course_name}</Text>
                            </View>
                            <View style={{ backgroundColor: isPending ? colors.warningLight : colors.successLight, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full }}>
                              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: isPending ? colors.warningText : colors.successText }}>
                                {isPending ? t('quiz.upcoming_quiz') : t('session.completed')}
                              </Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', marginTop: spacing.sm, gap: spacing.md }}>
                            <Text style={textPresets.caption}>{t('quiz.questions_count', { count: q.question_count })}</Text>
                            <Text style={textPresets.caption}>·</Text>
                            <Text style={textPresets.caption}>{t('quiz.duration', { minutes: q.duration_minutes })}</Text>
                          </View>
                          {isPending && (
                            <Button
                              variant="primary"
                              title={t('quiz.start_quiz')}
                              onPress={() => router.push(`/(parent)/quiz/${q.id}?studentId=${child.student_id}`)}
                              style={{ marginTop: spacing.sm }}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </>
          )}

          {activeTab === 'settings' && (
            <>
              <View style={cardStyle}>
                <Text style={textPresets.h3}>{t('child_settings.title')}</Text>
                <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                    <Text style={textPresets.body}>{t('child_settings.student_code')}</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.brand }}>{child.student_code ?? '-'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                    <Text style={textPresets.body}>{t('child_settings.grade_level')}</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.textSecondary }}>{child.grade ?? '-'}</Text>
                  </View>
                </View>
              </View>

              {child.teachers && child.teachers.length > 0 && (
                <View style={cardStyle}>
                  <Text style={textPresets.h3}>{t('parent.teachers')}</Text>
                  <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                    {child.teachers.map((teacher) => (
                      <View key={teacher.id} style={{ paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                            <Icon name="teacher" size={20} color={colors.brand} />
                          </View>
                          <Text style={[textPresets.body, { flex: 1 }]}>{teacher.name}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  <Button
                    variant="primary"
                    title={t('parent.manage_teachers')}
                    onPress={() => router.push(`/(parent)/child/${child.id}/teachers`)}
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              )}

            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, width: '80%', maxHeight: 300, overflow: 'hidden', ...shadows.lg }}>
            <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
              <Text style={[textPresets.h3, { textAlign: 'center' }]}>{t('child_settings.switch_child')}</Text>
            </View>
            <FlatList
              data={children ?? []}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  onPress={() => { router.replace(`/(parent)/child/${item.id}`); setShowPicker(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: index === selectedIndex ? colors.brandTint : 'transparent' }}
                >
                  <Avatar name={item.name} size={40} />
                  <View style={{ marginStart: spacing.md, flex: 1 }}>
                    <Text style={[textPresets.body, { fontFamily: fonts.bold }]}>{item.name}</Text>
                    <Text style={textPresets.caption}>{item.grade}</Text>
                  </View>
                  {index === selectedIndex && (
                    <Icon name="success" size={20} color={colors.brand} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
