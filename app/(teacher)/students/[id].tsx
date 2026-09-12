import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
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
import { useAuthStore } from '@/stores/authStore';
import { reportStudentIncident, flagParentNumber, type IncidentType, type SafetyCategory } from '@/api/students';
import { terminateEnrollment, transferEnrollment, backfillAttendance, setCyclePosition } from '@/api/enrollments';
import { reportParentUnreachable, getStudentPerformanceUrl, getEnrollableClasses, reverseStudentPayment, removeStudentFromRoster, requestStudentEdit, collectStudentCharge, type EnrollableClass, type PendingBooklet, type BackfillDay } from '@/api/students';
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
  // Cancel a specific collected payment (teacher-only; the server enforces + returns
  // an empty `collected` list for assistants, so the UI is naturally hidden for them).
  const [reversing, setReversing] = useState<number | null>(null);
  const cancelPayment = (c: { kind: 'bill' | 'booklet' | 'booking'; id: number; label: string }) => {
    Alert.alert('إلغاء الدفع', `إلغاء دفع «${c.label}»؟ ستعود المستحقّات على الطالب.`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'إلغاء الدفع', style: 'destructive', onPress: async () => {
          setReversing(c.id);
          try { await reverseStudentPayment(id, c.kind, c.id); await refetch(); }
          catch { Alert.alert(t('common.error'), 'تعذّر إلغاء الدفع'); }
          finally { setReversing(null); }
        },
      },
    ]);
  };
  // «تم تحصيل الملزمة» straight from the profile. Same server path as the kiosk (paid_at,
  // receipt, oversight, audit), so the insights are right the same second. Teacher or an
  // assistant with scan_attendance — the server refuses anyone else.
  const [collecting, setCollecting] = useState<number | null>(null);
  const collectBooklet = (b: PendingBooklet) => {
    Alert.alert(
      'تحصيل الملزمة',
      `تأكيد تحصيل ملزمة «${b.course ?? ''}» بقيمة ${b.remaining} ${t('teacher.egp')}؟\n\nسيُرسَل إيصال لولي الأمر ويُحتسب المبلغ في التقارير المالية.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'تم التحصيل', onPress: async () => {
            setCollecting(b.id);
            try { await collectStudentCharge(id, 'booklet', b.id); await refetch(); }
            catch (e: any) { Alert.alert(t('common.error'), e?.response?.data?.message || 'تعذّر التحصيل'); }
            finally { setCollecting(null); }
          },
        },
      ],
    );
  };
  const { can } = useActiveAbilities();
  const canManage = can(ABILITY.MANAGE_STUDENTS);
  const canCollect = can(ABILITY.SCAN);
  const canMarkManual = can(ABILITY.MARK_MANUAL);

  // The paper register: tick the past days (last 90) this student attended before the
  // app knew them. Presence only — an unticked day stays unrecorded, not absent.
  const [backfillFor, setBackfillFor] = useState<{ enrollmentId: number; courseName: string | null; days: BackfillDay[] } | null>(null);
  const [backfillPicked, setBackfillPicked] = useState<(number | string)[]>([]);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const openBackfill = (c: { enrollment_id?: number; name: string | null; backfill_days?: BackfillDay[] }) => {
    if (!c.enrollment_id) return;
    setBackfillPicked([]);
    setBackfillFor({ enrollmentId: c.enrollment_id, courseName: c.name, days: c.backfill_days ?? [] });
  };
  // «الطالب على الحصة N» — the web picker, on the phone. Each number carries the day it
  // fell on; the server re-prices an unpaid invoice to match and says so.
  const [positionFor, setPositionFor] = useState<{ enrollmentId: number; courseName: string | null; position: number; threshold: number; positions: { n: number; label: string | null; is_past: boolean }[] } | null>(null);
  const [positionBusy, setPositionBusy] = useState(false);
  const pickPosition = async (n: number) => {
    if (!positionFor) return;
    setPositionBusy(true);
    try {
      const r = await setCyclePosition(positionFor.enrollmentId, n);
      setPositionFor(null);
      await refetch();
      const parts = [`الطالب الآن على الحصة ${r.position} من ${r.threshold}.`];
      if (r.repriced) parts.push(r.invoice_amount ? `أُعيد إصدار فاتورة الدورة بقيمة ${r.invoice_amount} ج.م.` : 'أُلغيت فاتورة الدورة.');
      else if (r.kept_paid) parts.push('الفاتورة المدفوعة لم تُمسّ.');
      Alert.alert('تم الضبط', parts.join('\n'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message || 'تعذّر ضبط الحصة');
    } finally {
      setPositionBusy(false);
    }
  };

  const submitBackfill = async () => {
    if (!backfillFor || backfillPicked.length === 0) { Alert.alert('', 'اختر يومًا واحدًا على الأقل'); return; }
    setBackfillBusy(true);
    try {
      const r = await backfillAttendance(backfillFor.enrollmentId, backfillPicked);
      setBackfillFor(null);
      await refetch();
      const parts = [`تم تسجيل ${r.created} ${r.created === 1 ? 'يوم حضور' : 'أيام حضور'}.`];
      if (r.moved && r.started_at) parts.push(`ضُبط بدء الطالب على الحصة ${r.started_at}.`);
      if (r.repriced) parts.push(r.invoice_amount ? `أُعيد إصدار فاتورة الدورة بقيمة ${r.invoice_amount} ج.م.` : 'أُلغيت فاتورة الدورة.');
      else if (r.kept_paid && r.moved) parts.push('الفاتورة المدفوعة لم تُمسّ.');
      Alert.alert('تم', parts.join('\n'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message || 'تعذّر تسجيل الحضور السابق');
    } finally {
      setBackfillBusy(false);
    }
  };
  const isTeacher = useAuthStore((s) => s.role) === 'teacher';
  // Incident reports: the teacher, or an assistant granted report_incidents (the report
  // still lands in the teacher's tenant; the assistant is recorded as who typed it).
  const canReport = isTeacher || can(ABILITY.REPORT_INCIDENTS);

  // Transfer one course enrollment to another of the teacher's own courses.
  const [transferFor, setTransferFor] = useState<{ enrollmentId: number; courseId: number; courseName: string | null } | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);

  // Name/phone correction REQUEST (goes to super-admin review — no direct edit).
  const [editOpen, setEditOpen] = useState(false);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const submitEdit = async () => {
    const first = editFirst.trim(), last = editLast.trim(), phone = editPhone.trim(), reason = editReason.trim();
    if (!first && !last && !phone) { Alert.alert('', 'حدّد الاسم أو الرقم الجديد على الأقل'); return; }
    if (!reason) { Alert.alert('', 'يرجى توضيح سبب طلب التعديل'); return; }
    setEditBusy(true);
    try {
      await requestStudentEdit(id, { first_name: first || undefined, last_name: last || undefined, phone: phone || undefined, reason });
      setEditOpen(false); setEditFirst(''); setEditLast(''); setEditPhone(''); setEditReason('');
      Alert.alert('تم الإرسال', 'تم إرسال طلب التعديل لمراجعة الإدارة.');
    } catch (e: any) {
      Alert.alert('تعذّر الإرسال', e?.response?.data?.message || 'حدث خطأ');
    } finally {
      setEditBusy(false);
    }
  };

  // Incident report (teacher-only) → super-admin review.
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDesc, setReportDesc] = useState('');
  const [reportType, setReportType] = useState<IncidentType>('behavioral');
  const [reportSafety, setReportSafety] = useState(false);
  const [reportSafetyCat, setReportSafetyCat] = useState<SafetyCategory>('physical_violence');
  const [reportBusy, setReportBusy] = useState(false);

  const submitReport = async () => {
    if (reportDesc.trim().length < 20) { Alert.alert('', 'يرجى كتابة وصف كافٍ للحادثة (20 حرفًا على الأقل)'); return; }
    setReportBusy(true);
    try {
      await reportStudentIncident(id, {
        description: reportDesc.trim(),
        report_type: reportType,
        severity: reportSafety ? 'safety_critical' : 'standard',
        safety_category: reportSafety ? reportSafetyCat : undefined,
      });
      setReportOpen(false); setReportDesc(''); setReportSafety(false); setReportType('behavioral');
      Alert.alert('تم الإرسال', 'تم إرسال البلاغ لمراجعة الإدارة. لن يظهر لأي معلم آخر إلا بعد اعتماده.');
    } catch (e: any) {
      Alert.alert('تعذّر الإرسال', e?.response?.data?.message || 'حدث خطأ');
    } finally {
      setReportBusy(false);
    }
  };

  // Flag a parent's phone number as fake/misleading (teacher-only) → super-admin review.
  const [flagFor, setFlagFor] = useState<{ id: number; name: string } | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagBusy, setFlagBusy] = useState(false);

  const submitFlag = async () => {
    if (!flagFor) return;
    setFlagBusy(true);
    try {
      await flagParentNumber(id, { parent_id: flagFor.id, reason: flagReason.trim() || undefined });
      setFlagFor(null); setFlagReason('');
      Alert.alert('تم الإرسال', 'تم إرسال البلاغ لمراجعة الإدارة. بعد التأكيد سيظهر التنبيه لجميع المعلمين.');
    } catch (e: any) {
      Alert.alert('تعذّر الإرسال', e?.response?.data?.message || 'حدث خطأ');
    } finally {
      setFlagBusy(false);
    }
  };
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

  // Remove a TERMINATED student from the roster now (before the 7-day grace). The bill stays.
  const confirmRemoveFromRoster = () => {
    Alert.alert(
      'إزالة من القائمة',
      'إزالة هذا الطالب المُنهى من قائمتك الآن؟ تبقى مستحقاته دون تغيير.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'إزالة',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeStudentFromRoster(id);
              router.back();
            } catch {
              Alert.alert(t('common.error'), 'تعذّرت الإزالة من القائمة');
            }
          },
        },
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

          {/* The API this app is talking to predates the sections below (cycle progress,
              booklet collection, the paper register): they render from fields it does not
              send, so they would simply be absent with no explanation. Say so — in dev
              only, so a store build never shows this to a teacher. */}
          {__DEV__ && s.courses.length > 0 && s.courses[0].cycle === undefined ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.warningLight, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md }}>
              <Icon name="warning" size={18} color={colors.warning} />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
                الخادم غير محدَّث: لا تصل بيانات عدّاد الحصص والملازم والسجل الورقي، لذلك لا تظهر هذه الأقسام. حدِّث الـ API ثم اسحب للتحديث.
              </Text>
            </View>
          ) : null}

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

          {/* Request a name/phone correction — goes to super-admin review (no direct edit) */}
          {canManage ? (
            <TouchableOpacity
              onPress={() => setEditOpen(true)}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md }}
            >
              <Icon name="note" size={18} color={colors.textSecondary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary }}>طلب تعديل الاسم/الرقم</Text>
            </TouchableOpacity>
          ) : null}

          {/* Report an incident about the student → super-admin review (teacher, or assistant with report_incidents) */}
          {canReport ? (
            <TouchableOpacity
              onPress={() => setReportOpen(true)}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md }}
            >
              <Icon name="warning" size={18} color={colors.danger} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.danger }}>الإبلاغ عن حادثة</Text>
            </TouchableOpacity>
          ) : null}

          {/* An assistant who has not been granted report_incidents sees no report button —
              which reads as a missing feature. Name the reason instead. */}
          {!isTeacher && !canReport ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm }}>
              <Icon name="lock" size={16} color={colors.textSecondary} />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
                الإبلاغ عن الحوادث وأرقام أولياء الأمور غير مُفعَّل لحسابك — اطلب من المعلم تفعيله من صفحة المساعدين.
              </Text>
            </View>
          ) : null}

          {/* Remove a terminated student from the roster now (before the 7-day grace) */}
          {s.can_remove_from_roster ? (
            <TouchableOpacity
              onPress={confirmRemoveFromRoster}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md }}
            >
              <Icon name="person-remove" size={18} color={colors.textSecondary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary }}>إزالة من القائمة</Text>
            </TouchableOpacity>
          ) : null}

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

            {/* Price set on a course, but the teacher-wide booklets switch is off — say why there is no button. */}
            {s.billing.booklets_disabled_hint ? (
              <View style={{ marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
                <Icon name="book" size={18} color={colors.textSecondary} outline />
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
                  سعر الملزمة محدّد في المقرر، لكن الملازم غير مفعّلة في إعداداتك. فعّلها من صفحة الفواتير على الويب ليظهر زر «تم تحصيل الملزمة» هنا.
                </Text>
              </View>
            ) : null}

            {/* «تم تحصيل الملزمة» — one button per ملزمة still owed (teacher / assistant with scan). */}
            {canCollect && (s.billing.booklets ?? []).length > 0 ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs }}>ملازم مستحقّة</Text>
                {(s.billing.booklets ?? []).map((b) => (
                  <View key={`booklet-${b.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                    <Icon name="book" size={18} color={colors.textSecondary} outline />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{`ملزمة ${b.course ?? ''}`}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        {`${b.remaining} ${t('teacher.egp')}`}{b.partial ? ` · متبقٍّ من ${b.original}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => collectBooklet(b)}
                      disabled={collecting === b.id}
                      accessibilityRole="button"
                      activeOpacity={0.85}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: spacing.md, opacity: collecting === b.id ? 0.6 : 1 }}
                    >
                      {collecting === b.id ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="success" size={14} color="#fff" />}
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>تم تحصيل الملزمة</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

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

            {/* Collected payments the teacher can CANCEL (per-charge). */}
            {(s.billing.collected ?? []).length > 0 ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs }}>مدفوعات محصّلة — يمكنك إلغاؤها</Text>
                {(s.billing.collected ?? []).map((c) => (
                  <View key={`${c.kind}-${c.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>{c.label}</Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.success, marginTop: 2 }}>{`مدفوع ${c.paid} ${t('teacher.egp')}`}</Text>
                    </View>
                    <TouchableOpacity onPress={() => cancelPayment(c)} disabled={reversing === c.id} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: spacing.md }}>
                      {reversing === c.id ? <ActivityIndicator size="small" color={colors.danger} /> : <Icon name="close" size={14} color={colors.danger} />}
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.danger }}>إلغاء الدفع</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
          </Section>

          {/* Courses — one row per enrollment with clearly LABELED actions (transfer to
              another of the teacher's courses / terminate). Previously these were tiny
              unlabeled icons inside a pill and were hard to find. */}
          {s.courses.length > 0 ? (
            <Section title={t('teacher.student_courses')}>
              <View style={{ gap: spacing.sm }}>
                {s.courses.map((c) => (
                  <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
                    <Icon name="book" size={16} color={colors.brand} outline />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}>{c.name ?? '—'}</Text>
                      {/* «حضر ٤ من ٦ · الحصة ٧ / ٨» — what the cycle counted vs. what the student
                          was in the room for. Carried sessions (before the student was on the
                          system) are left out of the denominator. */}
                      {c.cycle?.has_cycle ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: c.cycle.held > 0 && c.cycle.attended < c.cycle.held ? colors.warning : colors.textSecondary }}>
                            {`حضر ${c.cycle.attended} من ${c.cycle.held}`}
                            {c.cycle.absent > 0 ? ` · غاب ${c.cycle.absent}` : ''}
                            {c.cycle.carried > 0 ? ` · انضم من الحصة ${c.cycle.carried + 1}` : ''}
                            {' · '}
                          </Text>
                          <TouchableOpacity
                            disabled={!canManage || !c.enrollment_id}
                            onPress={() => setPositionFor({ enrollmentId: c.enrollment_id!, courseName: c.name, position: c.cycle!.position, threshold: c.cycle!.threshold, positions: c.timeline_positions ?? [] })}
                            accessibilityRole="button"
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: canManage ? 6 : 0, paddingVertical: 1, borderRadius: radius.full, backgroundColor: canManage ? colors.brandTint : 'transparent' }}
                          >
                            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: canManage ? colors.brand : colors.textSecondary }}>{`الحصة ${c.cycle.position} / ${c.cycle.threshold}`}</Text>
                            {canManage ? <Icon name="note" size={12} color={colors.brand} /> : null}
                          </TouchableOpacity>
                        </View>
                      ) : null}
                      {canMarkManual && c.enrollment_id && (c.backfill_days ?? []).some((d) => d.recorded == null) ? (
                        <TouchableOpacity onPress={() => openBackfill(c)} accessibilityRole="button" activeOpacity={0.8} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.brand }}>
                            {`تسجيل حضور سابق (${(c.backfill_days ?? []).filter((d) => d.recorded == null).length} يوم بلا سجل)`}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {c.enrollment_id && canManage ? (
                      <TouchableOpacity
                        onPress={() => setTransferFor({ enrollmentId: c.enrollment_id!, courseId: c.id, courseName: c.name })}
                        accessibilityRole="button"
                        accessibilityLabel={t('teacher.transfer_title')}
                        activeOpacity={0.85}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brandTint, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: spacing.sm }}
                      >
                        <Icon name="transfer" size={16} color={colors.brand} />
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('teacher.transfer_action')}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {c.enrollment_id && canManage ? (
                      <TouchableOpacity
                        onPress={() => confirmTerminate(c.name, c.enrollment_id)}
                        accessibilityRole="button"
                        accessibilityLabel={t('teacher.terminate_title')}
                        activeOpacity={0.85}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.dangerLight, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: spacing.sm }}
                      >
                        <Icon name="trash" size={14} color={colors.danger} />
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.danger }}>{t('teacher.terminate_action')}</Text>
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
                  {/* Report this parent's number as fake/misleading → (assistant: teacher review first →) super-admin review */}
                  {canReport && !p.number_flagged ? (
                    <TouchableOpacity onPress={() => setFlagFor({ id: p.id, name: p.name ?? '—' })} accessibilityRole="button"
                                      style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.dangerLight, justifyContent: 'center', alignItems: 'center' }}>
                      <Icon name="warning" size={18} color={colors.danger} />
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
      {/* «الطالب على الحصة N» — pick the number, see the day it fell on. */}
      <Modal visible={!!positionFor} animationType="slide" transparent onRequestClose={() => !positionBusy && setPositionFor(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{`الطالب على الحصة رقم — ${positionFor?.courseName ?? ''}`}</Text>
              <TouchableOpacity onPress={() => !positionBusy && setPositionFor(null)} hitSlop={10}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginBottom: spacing.sm }}>
              الحصة التي بدأ منها الطالب — ما قبلها لا يُحاسَب عليه. تُعاد تسعير فاتورة الدورة غير المدفوعة تلقائيًا؛ الفواتير المدفوعة لا تتغيّر.
            </Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {Array.from({ length: positionFor?.threshold ?? 0 }, (_, i) => i + 1).map((n) => {
                const pos = positionFor?.positions.find((p) => p.n === n);
                const current = n === positionFor?.position;
                return (
                  <TouchableOpacity
                    key={n}
                    disabled={positionBusy}
                    onPress={() => pickPosition(n)}
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: current ? colors.brandTint : 'transparent', borderRadius: radius.md, paddingHorizontal: spacing.sm }}
                  >
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: current ? colors.brand : colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: current ? '#fff' : colors.textPrimary }}>{n}</Text>
                    </View>
                    <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}>
                      {pos?.label ?? '—'}{pos && !pos.is_past ? '  · قادمة' : ''}
                    </Text>
                    {current ? <Badge label="الحالية" variant="info" size="sm" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {positionBusy ? <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.brand} /> : null}
          </View>
        </View>
      </Modal>

      {/* The paper register — past days of one course, tick who came. */}
      <Modal visible={!!backfillFor} animationType="slide" transparent onRequestClose={() => !backfillBusy && setBackfillFor(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>تسجيل حضور سابق من السجل الورقي</Text>
              <TouchableOpacity onPress={() => !backfillBusy && setBackfillFor(null)} hitSlop={10}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
              {`حصص «${backfillFor?.courseName ?? ''}» خلال آخر ٩٠ يومًا. علّم الأيام التي حضرها الطالب حسب الدفتر — يُسجَّل الحضور فقط؛ اليوم غير المعلَّم يبقى بلا سجل.`}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.sm }}>
              سيُضبط بدء الطالب على أقدم يوم مختار وتُعاد تسعير فاتورة الدورة غير المدفوعة. الفواتير المدفوعة لا تتغيّر.
            </Text>
            <TouchableOpacity onPress={() => setBackfillPicked((backfillFor?.days ?? []).filter((d) => d.recorded == null).map((d) => d.id))} style={{ alignSelf: 'flex-start', marginBottom: spacing.xs }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.brand }}>تحديد كل الأيام غير المسجّلة</Text>
            </TouchableOpacity>
            <ScrollView style={{ maxHeight: 360 }}>
              {(backfillFor?.days ?? []).map((d) => {
                const locked = d.recorded != null;
                const on = locked ? (d.recorded === 'present' || d.recorded === 'late') : backfillPicked.includes(d.id);
                const tag = locked ? ({ present: 'حاضر', late: 'متأخر', absent: 'غائب', excused: 'بعذر' } as Record<string, string>)[d.recorded!] ?? d.recorded : (d.virtual ? 'حسب الجدول' : (d.before_enrolment ? 'قبل التسجيل' : 'بلا سجل'));
                return (
                  <TouchableOpacity
                    key={String(d.id)}
                    disabled={locked}
                    onPress={() => setBackfillPicked((p) => (p.includes(d.id) ? p.filter((x) => x !== d.id) : [...p, d.id]))}
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: locked ? 0.55 : 1 }}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brand : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                      {on ? <Icon name="success" size={14} color="#fff" /> : null}
                    </View>
                    <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}>{`${d.label} · ${d.time}`}</Text>
                    <Badge label={tag ?? ''} variant={locked ? 'default' : (d.before_enrolment ? 'warning' : 'default')} size="sm" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              onPress={submitBackfill}
              disabled={backfillBusy}
              accessibilityRole="button"
              style={{ marginTop: spacing.md, minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', opacity: backfillBusy ? 0.6 : 1 }}
            >
              {backfillBusy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{`تسجيل الحضور (${backfillPicked.length})`}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

      {/* Name/phone correction request → super-admin review */}
      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => !editBusy && setEditOpen(false)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '88%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>طلب تعديل بيانات الطالب</Text>
              <TouchableOpacity onPress={() => !editBusy && setEditOpen(false)} hitSlop={10}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              يراجع مدير النظام الطلب قبل تطبيقه. اترك الحقل فارغًا إن لم ترغب بتغييره.
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.md }}>
              {[
                { label: 'الاسم الأول', value: editFirst, set: setEditFirst, kb: 'default' as const },
                { label: 'الاسم الأخير', value: editLast, set: setEditLast, kb: 'default' as const },
                { label: 'رقم الهاتف', value: editPhone, set: setEditPhone, kb: 'phone-pad' as const },
              ].map((f) => (
                <View key={f.label} style={{ marginBottom: spacing.md }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, textAlign: 'right' }}>{f.label}</Text>
                  <TextInput
                    value={f.value}
                    onChangeText={f.set}
                    keyboardType={f.kb}
                    placeholderTextColor={colors.textTertiary}
                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }}
                  />
                </View>
              ))}
              <View style={{ marginBottom: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, textAlign: 'right' }}>سبب التعديل *</Text>
                <TextInput
                  value={editReason}
                  onChangeText={setEditReason}
                  multiline
                  placeholder="مثال: خطأ إملائي في الاسم / رقم قديم"
                  placeholderTextColor={colors.textTertiary}
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 76, textAlignVertical: 'top', fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }}
                />
              </View>

              <TouchableOpacity
                onPress={submitEdit}
                disabled={editBusy}
                activeOpacity={0.85}
                style={{ backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', opacity: editBusy ? 0.6 : 1 }}
              >
                {editBusy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>إرسال للمراجعة</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Incident report → super-admin review (teacher-only) */}
      <Modal visible={reportOpen} animationType="slide" transparent onRequestClose={() => !reportBusy && setReportOpen(false)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '90%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>الإبلاغ عن حادثة</Text>
              <TouchableOpacity onPress={() => !reportBusy && setReportOpen(false)} hitSlop={10}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              يُراجع مدير النظام البلاغ ولا يظهر لأي معلم آخر إلا بعد اعتماده.
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, textAlign: 'right' }}>نوع البلاغ</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
                {([['behavioral', 'سلوكي'], ['communication', 'تواصل'], ['attendance_discipline', 'انضباط'], ['other', 'أخرى']] as [IncidentType, string][]).map(([val, label]) => (
                  <TouchableOpacity key={val} onPress={() => setReportType(val)} activeOpacity={0.85}
                    style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: reportType === val ? colors.brand : colors.border, backgroundColor: reportType === val ? colors.brandTint : colors.surface }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: reportType === val ? colors.brand : colors.textSecondary }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, textAlign: 'right' }}>وصف الحادثة *</Text>
              <TextInput value={reportDesc} onChangeText={setReportDesc} multiline placeholder="اكتب وصفًا واضحًا (20 حرفًا على الأقل)" placeholderTextColor={colors.textTertiary}
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 96, textAlignVertical: 'top', fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.md }} />

              <TouchableOpacity onPress={() => setReportSafety((v) => !v)} activeOpacity={0.85}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: reportSafety ? colors.dangerLight : colors.surface, borderWidth: 1.5, borderColor: reportSafety ? colors.danger : colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
                <Icon name="warning" size={18} color={reportSafety ? colors.danger : colors.textTertiary} />
                <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: reportSafety ? colors.danger : colors.textSecondary }}>حادثة خطيرة (تتطلب مراجعة عاجلة)</Text>
                <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: reportSafety ? colors.danger : colors.border, backgroundColor: reportSafety ? colors.danger : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {reportSafety ? <Icon name="success" size={12} color="#fff" /> : null}
                </View>
              </TouchableOpacity>

              {reportSafety ? (
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, textAlign: 'right' }}>نوع الخطر *</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {([['weapon', 'سلاح'], ['physical_violence', 'عنف جسدي'], ['other_immediate_danger', 'خطر مباشر آخر']] as [SafetyCategory, string][]).map(([val, label]) => (
                      <TouchableOpacity key={val} onPress={() => setReportSafetyCat(val)} activeOpacity={0.85}
                        style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: reportSafetyCat === val ? colors.danger : colors.border, backgroundColor: reportSafetyCat === val ? colors.dangerLight : colors.surface }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: reportSafetyCat === val ? colors.danger : colors.textSecondary }}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              <TouchableOpacity onPress={submitReport} disabled={reportBusy} activeOpacity={0.85}
                style={{ backgroundColor: reportSafety ? colors.danger : colors.brand, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', opacity: reportBusy ? 0.6 : 1 }}>
                {reportBusy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>إرسال البلاغ</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Flag a parent's phone number → super-admin review (teacher-only) */}
      <Modal visible={!!flagFor} animationType="slide" transparent onRequestClose={() => !flagBusy && setFlagFor(null)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>الإبلاغ عن رقم غير صحيح</Text>
              <TouchableOpacity onPress={() => !flagBusy && setFlagFor(null)} hitSlop={10}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              الإبلاغ عن رقم ولي الأمر «{flagFor?.name}» كرقم غير صحيح/مضلِّل. بعد اعتماد الإدارة يظهر التنبيه لجميع المعلمين.
            </Text>
            <TextInput value={flagReason} onChangeText={setFlagReason} multiline placeholder="السبب (اختياري)" placeholderTextColor={colors.textTertiary}
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 72, textAlignVertical: 'top', fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.md }} />
            <TouchableOpacity onPress={submitFlag} disabled={flagBusy} activeOpacity={0.85}
              style={{ backgroundColor: colors.danger, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', opacity: flagBusy ? 0.6 : 1 }}>
              {flagBusy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>إرسال البلاغ</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
