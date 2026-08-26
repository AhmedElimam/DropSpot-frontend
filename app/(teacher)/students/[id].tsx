import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, RefreshControl, Alert, Modal } from 'react-native';
import { useState } from 'react';
import { openRemotePdf } from '@/utils/openPdf';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/layout/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useStudentDetail } from '@/hooks/useStudents';
import { useSetStudentAllowanceBlock } from '@/hooks/useOverrides';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { terminateEnrollment, transferEnrollment } from '@/api/enrollments';
import { reportParentUnreachable, getStudentPerformanceUrl, getEnrollableClasses, type EnrollableClass } from '@/api/students';
import { useMutation, useQuery } from '@tanstack/react-query';
import { dayLabel, formatDayDate } from '@/utils/format';

// Attendance status → an i18n key + Badge variant. 'not_recorded' is the neutral
// "no record for this session" state (only appears in session detail, kept here
// for completeness).
const STATUS_META: Record<string, { key: string; variant: BadgeVariant }> = {
  present: { key: 'attendance.present', variant: 'success' },
  late: { key: 'attendance.late', variant: 'warning' },
  absent: { key: 'attendance.absent', variant: 'danger' },
  excused: { key: 'attendance.excused', variant: 'info' },
  not_recorded: { key: 'teacher.not_recorded', variant: 'default' },
};

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, color }}>{value}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.md }}>{title}</Text>
      {children}
    </View>
  );
}

export default function StudentDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: s, isLoading, refetch } = useStudentDetail(id);
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const allowanceBlock = useSetStudentAllowanceBlock(Number(id));
  const [exporting, setExporting] = useState(false);
  const { can } = useActiveAbilities();
  const canManage = can(ABILITY.MANAGE_STUDENTS);

  // Transfer one course enrollment to another of the teacher's own courses.
  const [transferFor, setTransferFor] = useState<{ enrollmentId: number; courseId: number; courseName: string | null } | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const { data: destinations = [], isLoading: loadingDests } = useQuery({
    queryKey: ['enrollable-classes'],
    queryFn: getEnrollableClasses,
    enabled: !!transferFor,
  });

  const doTransfer = async (dest: EnrollableClass, acceptGradeMismatch = false) => {
    if (!transferFor || transferBusy) return;
    setTransferBusy(true);
    try {
      await transferEnrollment(transferFor.enrollmentId, dest.course_id, acceptGradeMismatch);
      setTransferFor(null);
      refetch();
    } catch (e: any) {
      const code = e?.response?.data?.code;
      const msg = e?.response?.data?.message;
      // Cross-grade → confirm, then retry accepting the mismatch (same as enroll).
      if (code === 'GRADE_MISMATCH') {
        Alert.alert(t('teacher.transfer_grade_mismatch_title'), msg || '', [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('teacher.transfer_confirm'), onPress: () => doTransfer(dest, true) },
        ]);
      } else {
        Alert.alert(t('common.error'), msg || t('teacher.transfer_failed'));
      }
    } finally {
      setTransferBusy(false);
    }
  };

  // Fetch a short-lived signed URL, then download + share the performance PDF.
  const exportPerformance = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const url = await getStudentPerformanceUrl(id);
      if (!url) throw new Error('no url');
      await openRemotePdf(url, s?.name ? `أداء-${s.name}` : `performance-${id}`);
    } catch {
      Alert.alert(t('common.error'), t('teacher.performance_export_failed'));
    } finally {
      setExporting(false);
    }
  };

  // Nudge the student when a parent call goes unanswered.
  const nudgeStudent = useMutation({
    mutationFn: () => reportParentUnreachable(id),
    onSuccess: () => Alert.alert(t('teacher.parent_call_reported_title'), t('teacher.parent_call_reported_body')),
    onError: () => Alert.alert(t('common.error'), t('teacher.parent_call_report_failed')),
  });

  // Open the dialer, then ask whether the parent answered. "No" → nudge the student.
  const callParent = (phone: string, parentName?: string | null) => {
    Linking.openURL(`tel:${phone}`);
    Alert.alert(
      t('teacher.parent_answered_q'),
      t('teacher.parent_answered_hint', { name: parentName ?? '' }),
      [
        { text: t('teacher.parent_answered_yes'), style: 'cancel' },
        { text: t('teacher.parent_answered_no'), style: 'destructive', onPress: () => nudgeStudent.mutate() },
      ],
    );
  };

  const confirmTerminate = (courseName: string | null, enrollmentId?: number) => {
    if (!enrollmentId) return;
    Alert.alert(
      t('teacher.terminate_title'),
      t('teacher.terminate_body', { course: courseName ?? '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('teacher.terminate_confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await terminateEnrollment(enrollmentId);
              refetch();
            } catch {
              Alert.alert(t('common.error'), t('teacher.terminate_failed'));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }} numberOfLines={1}>{s?.name ?? t('teacher.tab_students')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : !s ? (
        <EmptyState icon="child" title={t('teacher.student_not_found')} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Summary */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}>
            <Avatar name={s.name ?? '—'} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{s.name ?? '—'}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                {s.grade_name ?? t('teacher.no_grade')}{s.student_code ? ` · ${s.student_code}` : ''}
              </Text>
            </View>
          </View>

          {/* Export performance PDF */}
          <TouchableOpacity
            onPress={exportPerformance}
            disabled={exporting}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primary, paddingVertical: spacing.md }}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Icon name="download" size={18} color={colors.primary} />
            )}
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>
              {exporting ? t('teacher.performance_exporting') : t('teacher.performance_export')}
            </Text>
          </TouchableOpacity>

          {/* Attendance summary */}
          <Section title={t('teacher.attendance_summary')}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <StatTile label={t('teacher.stat_attended')} value={s.attendance_stats.attended} color={colors.success} />
              <StatTile label={t('teacher.stat_absent')} value={s.attendance_stats.absent} color={colors.danger} />
              <StatTile label={t('teacher.stat_excused')} value={s.attendance_stats.excused} color={colors.info} />
              <StatTile label={t('teacher.stat_total')} value={s.attendance_stats.total} color={colors.textPrimary} />
            </View>
          </Section>

          {/* Billing */}
          <Section title={t('teacher.billing_section')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: s.billing.has_overdue ? colors.danger : (s.billing.has_pending ? colors.warning : colors.border), padding: spacing.lg }}>
              <Icon name="money" size={24} color={s.billing.has_overdue ? colors.danger : (s.billing.has_pending ? colors.warning : colors.success)} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: s.billing.has_overdue ? colors.danger : colors.textPrimary }}>
                  {s.billing.has_pending
                    ? `${t('teacher.billing_pending')} · ${s.billing.pending_total} ${t('teacher.egp')}`
                    : t('teacher.billing_clear')}
                </Text>
                {s.billing.has_pending && s.billing.pending ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    {[
                      Number(s.billing.pending.bill) > 0 ? `${t('teacher.due_bill')}: ${s.billing.pending.bill}` : null,
                      Number(s.billing.pending.booklet) > 0 ? `${t('teacher.due_booklet')}: ${s.billing.pending.booklet}` : null,
                      Number(s.billing.pending.booking) > 0 ? `${t('teacher.due_booking')}: ${s.billing.pending.booking}` : null,
                    ].filter(Boolean).join('   ·   ')}
                  </Text>
                ) : null}
                {s.billing.has_overdue ? (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.danger, marginTop: 2 }}>
                    {`${t('teacher.billing_overdue')} · ${s.billing.overdue_amount} ${t('teacher.egp')}`}
                  </Text>
                ) : null}
                {s.billing.override_active ? (
                  <View style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                    <Badge label={t('teacher.billing_override_active')} variant="info" size="sm" />
                    {s.billing.override_expires_at ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>
                        {t('teacher.override_until', { date: formatDayDate(s.billing.override_expires_at) })}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>

            {/* Per-student 15-day-allowance block */}
            <TouchableOpacity
              onPress={() => allowanceBlock.mutate(!(s.billing.allowance_blocked ?? false))}
              disabled={allowanceBlock.isPending}
              activeOpacity={0.8}
              style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: s.billing.allowance_blocked ? colors.danger : colors.border, padding: spacing.md }}
            >
              <Icon name={s.billing.allowance_blocked ? 'lock' : 'calendar'} size={20} color={s.billing.allowance_blocked ? colors.danger : colors.textSecondary} outline />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: s.billing.allowance_blocked ? colors.danger : colors.textPrimary }}>
                  {s.billing.allowance_blocked ? t('teacher.allowance_allow_student') : t('teacher.allowance_block_student')}
                </Text>
                {s.billing.allowance_enabled === false ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('teacher.allowance_off_all')}</Text>
                ) : null}
              </View>
              {allowanceBlock.isPending ? <ActivityIndicator size="small" color={colors.brand} /> : null}
            </TouchableOpacity>
          </Section>

          {/* Courses */}
          {s.courses.length > 0 ? (
            <Section title={t('teacher.student_courses')}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {s.courses.map((c) => (
                  <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brandTint, borderRadius: radius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{c.name ?? '—'}</Text>
                    {c.enrollment_id && canManage ? (
                      <TouchableOpacity
                        onPress={() => setTransferFor({ enrollmentId: c.enrollment_id!, courseId: c.id, courseName: c.name })}
                        accessibilityRole="button"
                        accessibilityLabel={t('teacher.transfer_title')}
                        hitSlop={8}
                      >
                        <Icon name="send" size={15} color={colors.brand} />
                      </TouchableOpacity>
                    ) : null}
                    {c.enrollment_id ? (
                      <TouchableOpacity onPress={() => confirmTerminate(c.name, c.enrollment_id)} accessibilityRole="button" hitSlop={8}>
                        <Icon name="trash" size={15} color={colors.danger} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {/* Parents */}
          {s.parents.length > 0 ? (
            <Section title={t('teacher.student_parents')}>
              {s.parent_number_notice ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.dangerLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
                  <Icon name="call" size={18} color={colors.dangerText} />
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.dangerText }}>
                    {s.parent_number_notice_message ?? t('teacher.number_fake')}
                  </Text>
                </View>
              ) : null}
              {s.parents.map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{p.name ?? '—'}</Text>
                      {p.is_primary ? <Badge label={t('teacher.primary_parent')} variant="success" size="sm" /> : null}
                      {p.number_flagged ? (
                        <Badge label={t('teacher.number_fake')} variant="danger" size="sm" />
                      ) : p.phone_verified ? (
                        <Badge label={t('teacher.number_verified')} variant="success" size="sm" />
                      ) : null}
                    </View>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                      {p.relationship ?? ''}{p.phone ? ` · ${p.phone}` : ` · ${t('teacher.no_phone')}`}
                    </Text>
                  </View>
                  {p.phone ? (
                    <TouchableOpacity onPress={() => callParent(p.phone!, p.name)} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.successLight, justifyContent: 'center', alignItems: 'center' }}>
                      <Icon name="call" size={20} color={colors.success} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </Section>
          ) : null}

          {/* Attendance history */}
          <Section title={t('teacher.attendance_history')}>
            {s.attendance.length === 0 ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{t('teacher.no_attendance')}</Text>
            ) : (
              s.attendance.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.not_recorded;
                return (
                  <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{r.course_name ?? '—'}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{dayLabel(r.date)}</Text>
                    </View>
                    <Badge label={t(meta.key)} variant={meta.variant} size="sm" />
                  </View>
                );
              })
            )}
          </Section>
        </ScrollView>
      )}

      {/* Transfer picker: move this enrollment to another of the teacher's courses. */}
      <Modal visible={!!transferFor} animationType="slide" transparent onRequestClose={() => !transferBusy && setTransferFor(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '75%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('teacher.transfer_title')}</Text>
              <TouchableOpacity onPress={() => !transferBusy && setTransferFor(null)} hitSlop={10}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              {t('teacher.transfer_from', { course: transferFor?.courseName ?? '—' })}
            </Text>

            {loadingDests ? (
              <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.xl }} />
            ) : (
              (() => {
                const options = destinations.filter((d) => d.course_id !== transferFor?.courseId);
                if (options.length === 0) {
                  return (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary, textAlign: 'center', marginVertical: spacing.xl }}>
                      {t('teacher.transfer_no_courses')}
                    </Text>
                  );
                }
                return (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {options.map((d) => (
                      <TouchableOpacity
                        key={d.course_id}
                        onPress={() => doTransfer(d)}
                        disabled={transferBusy}
                        activeOpacity={0.8}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, opacity: transferBusy ? 0.6 : 1 }}
                      >
                        <Icon name="book" size={20} color={colors.brand} />
                        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary }}>{d.course_name}</Text>
                        <Icon name="forward" size={18} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                );
              })()
            )}

            {transferBusy ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.sm }} /> : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
