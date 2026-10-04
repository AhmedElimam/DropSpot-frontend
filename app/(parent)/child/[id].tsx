import { useState } from 'react';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, RefreshControl } from 'react-native';
import { ScrollView, FlatList } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav, gradients } from '@/theme/index';
import { useChildren } from '@/hooks/useChildren';
import { getStudentCoverage, getAttendanceRecords } from '@/api/attendance';
import { getStudentGrades } from '@/api/grades';
import { getStudentExamResults } from '@/api/exams';
import { getUpcomingStudentSessions } from '@/api/sessions';
import { formatDate, formatTime } from '@/utils/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/layout/Avatar';
import { Icon } from '@/components/ui/Icon';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead } from '@/components/ui/SectionHead';
import { formatNumber } from '@/utils/format';
import { AttendanceOverview } from '@/components/attendance/AttendanceOverview';
import { AttendanceRecordRow } from '@/components/attendance/AttendanceRecordRow';
import { ComplaintSheet, type ComplaintTarget } from '@/components/student/ComplaintSheet';
import { useMyComplaints } from '@/hooks/useComplaints';
import { avatarSeed } from '@/components/ui/GeneratedAvatar';

type TabKey = 'attendance' | 'grades' | 'exams' | 'settings';

const cardStyle = () => ({
  backgroundColor: colors.surface,
  borderRadius: radius.xxl,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.xl,
  ...shadows.sm,
} as const);

function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const day = formatDate(d, { month: 'short' });
  // 12h (ص/م) — hour12 + ar-EG to match the app-wide formatTime12 convention.
  const time = formatTime(d);
  return `${day} · ${time}`;
}

export default function ChildDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const { data: children, isLoading: childrenLoading, refetch: refetchChildren } = useChildren();
  const [activeTab, setActiveTab] = useState<TabKey>('attendance');
  const [showPicker, setShowPicker] = useState(false);
  const [showAllRecords, setShowAllRecords] = useState(false);
  // A parent may dispute a child's mark the way the student can (founder 2026-10-03).
  const [complaintTarget, setComplaintTarget] = useState<ComplaintTarget | null>(null);
  const complaints = useMyComplaints();

  const selectedIndex = Math.max(0, (children ?? []).findIndex((c) => c.id === params.id));
  const child = (children ?? [])[selectedIndex];

  const { data: coverage, isLoading: coverageLoading, refetch: refetchCoverage } = useQuery({
    queryKey: ['attendance', 'stats', child?.student_id],
    queryFn: () => getStudentCoverage(child!.student_id),
    enabled: !!child,
  });

  const { data: grades, isLoading: gradesLoading, refetch: refetchGrades } = useQuery({
    queryKey: ['grades', child?.student_id],
    queryFn: () => getStudentGrades(child!.student_id),
    enabled: !!child,
  });

  // Physical exam results (نتيجة الامتحان) — repurposed from the retired in-app quizzes tab.
  const { data: exams, isLoading: examsLoading, refetch: refetchExams } = useQuery({
    queryKey: ['exam-results', child?.student_id],
    queryFn: () => getStudentExamResults(child!.student_id),
    enabled: !!child,
  });

  const { data: records, isLoading: recordsLoading, refetch: refetchRecords } = useQuery({
    queryKey: ['attendance', 'records', child?.student_id],
    queryFn: () => getAttendanceRecords(child!.student_id),
    enabled: !!child,
  });

  const { data: upcoming, refetch: refetchUpcoming } = useQuery({
    queryKey: ['sessions', 'upcoming', child?.student_id],
    queryFn: () => getUpcomingStudentSessions(child!.student_id, 5),
    enabled: !!child,
  });

  // A parent opens this screen to check on their child right now — the pull must refresh
  // everything the page shows (attendance, marks, exams, payments, next sessions), not
  // whichever query happened to go stale first.
  const { refreshing, onRefresh } = usePullRefresh(
    refetchChildren, refetchCoverage, refetchGrades, refetchExams, refetchRecords, refetchUpcoming,
  );

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
    { key: 'exams', label: t('reports.exam_results') },
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
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.pageEnd + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <PageHero
          title={child.name}
          subtitle={`${child.grade ?? ''}${child.student_code ? ` · ${child.student_code}` : ''}`}
          onBack
          action={{ icon: 'children', label: t('home.children_section'), onPress: () => setShowPicker(true), accessibilityLabel: t('home.children_section') }}
          stats={[
            { value: `${formatNumber(attendanceRate)}%`, label: t('attendance.attendance_rate') },
            { value: `${formatNumber(avgGrade)}%`, label: t('quiz.avg_score') },
            { value: formatNumber(absent), label: t('attendance.absent'), warn: absent > 0 },
          ]}
        >
          {/* Quick shortcut to the pre-card registration QR (else buried in Settings). */}
          {child.can_generate_pre_card ? (
            <TouchableOpacity
              onPress={() => router.push(`/(parent)/child/${child.id}/invite-code`)}
              accessibilityRole="button"
              accessibilityLabel={t('auth.invite_code_label')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', marginTop: spacing.md, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: spacing.md }}
            >
              <Icon name="scan" size={16} color={colors.onHero} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onHero }}>{t('auth.invite_code_label')}</Text>
            </TouchableOpacity>
          ) : null}
        </PageHero>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4 }}>
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
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={{ fontFamily: activeTab === tab.key ? fonts.bold : fonts.medium, fontSize: 14, color: activeTab === tab.key ? colors.brand : colors.textSecondary, textAlign: 'center' }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.md }}>
          {activeTab === 'attendance' && (
            <>
              {upcoming && upcoming.length > 0 && (
                <View style={cardStyle()}>
                  <SectionHead icon="calendar" color={colors.brand} title={t('session.upcoming_sessions')} />
                  <View style={{ marginTop: spacing.md }}>
                    {upcoming.map((s, i) => (
                      <View
                        key={s.id}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: i < upcoming.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}
                      >
                        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                          <Icon name="calendar" size={18} color={colors.brand} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={textPresets.body}>{s.course_name ?? ''}</Text>
                          <Text style={textPresets.caption}>
                            {fmtDateTime(s.scheduled_at)}{s.teacher_name ? ` · ${s.teacher_name}` : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              <View style={cardStyle()}>
                <SectionHead icon="attendance" color={colors.success} title={t('attendance.history_title')} />
                <Text style={[textPresets.bodySmall, { marginTop: 2, marginBottom: spacing.md }]}>{t('attendance.history_sub_child')}</Text>
                {coverageLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <AttendanceOverview present={present} late={coverage?.late ?? 0} absent={absent} excused={excused} />
                )}
                <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md }} />
                {recordsLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : !records?.length ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, textAlign: 'center', padding: spacing.md }}>
                    {t('attendance.no_records')}
                  </Text>
                ) : (
                  <>
                    {records.slice(0, showAllRecords ? records.length : 8).map((r, i, arr) => (
                      <AttendanceRecordRow
                        key={r.id || i}
                        record={r}
                        complaint={r.session_instance_id ? complaints.bySession.get(r.session_instance_id) : undefined}
                        onComplain={(rec) => setComplaintTarget({ type: 'attendance', sessionInstanceId: rec.session_instance_id, courseName: rec.course_name ?? '', sessionAt: rec.session_time ?? null, recordedStatus: rec.status ?? null })}
                        last={i === arr.length - 1}
                      />
                    ))}
                    {records.length > 8 ? (
                      <TouchableOpacity onPress={() => setShowAllRecords((v) => !v)} activeOpacity={0.85} accessibilityRole="button"
                        style={{ marginTop: spacing.sm, minHeight: 42, borderRadius: radius.md, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                        <Icon name={showAllRecords ? 'up' : 'down'} size={16} color={colors.brand} />
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>
                          {showAllRecords ? t('attendance.show_less') : t('attendance.show_more', { count: formatNumber(records.length - 8) })}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md }}>
                      <Icon name="info" size={14} color={colors.textTertiary} outline />
                      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('attendance.dispute_hint')}</Text>
                    </View>
                  </>
                )}
              </View>
            </>
          )}

          {activeTab === 'grades' && (
            <>
              <View style={cardStyle()}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                  <SectionHead icon="grades" color={colors.brand} title={t('reports.grades')} />
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
              <Button
                variant="primary"
                title={t('reports.view_reports')}
                onPress={() => router.push(`/(parent)/report-cards?studentId=${child.student_id}`)}
              />
            </>
          )}

          {activeTab === 'exams' && (
            <>
              <View style={cardStyle()}>
                <SectionHead icon="reports" color={colors.accent} title={t('reports.exam_results')} />
                {examsLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.md }} />
                ) : !exams?.length ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, textAlign: 'center', padding: spacing.xl }}>
                    {t('reports.no_exams')}
                  </Text>
                ) : (
                  <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
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
            </>
          )}

          {activeTab === 'settings' && (
            <>
              <View style={cardStyle()}>
                <SectionHead icon="settings" color={colors.textSecondary} title={t('child_settings.title')} />
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

              {child.can_generate_pre_card && (
                <View style={cardStyle()}>
                  <Text style={textPresets.h3}>تسجيل عند المعلم قبل استلام البطاقة</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: spacing.sm }}>
                    عندما تكون مع المعلم الآن، أنشئ رمزًا مؤقتًا واعرضه له ليُسجّل ابنك في حصصه — يصلح لدقائق قليلة فقط وللاستخدام الفوري أمام المعلم، ولا يُرسل عبر واتساب.
                  </Text>
                  <Button
                    variant="primary"
                    title={t('auth.create_invite_code')}
                    onPress={() => router.push(`/(parent)/child/${child.id}/invite-code`)}
                    style={{ marginTop: spacing.lg }}
                  />
                </View>
              )}

              {child.teachers && child.teachers.length > 0 && (
                <View style={cardStyle()}>
                  <SectionHead icon="teacher" color={colors.brand} title={t('parent.teachers')} />
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

      <ComplaintSheet visible={!!complaintTarget} onClose={() => setComplaintTarget(null)} target={complaintTarget} forStudentId={child.student_id} />

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, width: '80%', maxHeight: 300, overflow: 'hidden', ...shadows.lg }}>
            <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
              <Text style={[textPresets.h3, { textAlign: 'center' }]}>{t('child_settings.switch_child')}</Text>
            </View>
            <FlatList showsVerticalScrollIndicator={false}
              removeClippedSubviews
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              updateCellsBatchingPeriod={50}
              windowSize={7}
              data={children ?? []}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  onPress={() => { router.replace(`/(parent)/child/${item.id}`); setShowPicker(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: index === selectedIndex ? colors.brandTint : 'transparent' }}
                >
                  <Avatar name={item.name} seed={avatarSeed.student(item.student_id, item.name)} size={40} />
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
