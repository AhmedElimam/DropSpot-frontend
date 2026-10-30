import { track } from '@/lib/analytics';
import { SheetModal } from '@/components/ui/SheetModal';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, RefreshControl, TextInput } from 'react-native';
import { Alert } from '@/ui/dialog';
import { ScrollView } from '@/components/ui/Refreshable';
import { useState } from 'react';
import { openRemotePdf } from '@/utils/openPdf';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, type GestureType } from 'react-native-gesture-handler';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { PageHero } from '@/components/ui/PageHero';
import { StudentDuesCard, collectTarget, parseCollectAmount, type CollectTarget } from '@/components/teacher/StudentDues';
import { CollectSheet } from '@/components/teacher/CollectSheet';
import { avatarSeed } from '@/components/ui/GeneratedAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { StudentAttendanceList } from '@/components/student/StudentAttendanceList';
import { PriorMonthSheet } from '@/components/teacher/PriorMonthSheet';
import { BillingYearSheet, type BillingYearTarget } from '@/components/teacher/BillingYearSheet';
import { useStudentDetail } from '@/hooks/useStudents';
import { useSetStudentAllowanceBlock } from '@/hooks/useOverrides';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { useAuthStore } from '@/stores/authStore';
import { reportStudentIncident, flagParentNumber, type IncidentType, type SafetyCategory, type CorrectableBill } from '@/api/students';
import { askRemovalSms } from '@/components/teacher/askRemovalSms';
import { terminateEnrollment, transferEnrollment, backfillAttendance, setCyclePosition, setCycleAmount, settleCycleBeforeJoining } from '@/api/enrollments';
import { reportParentUnreachable, getStudentPerformanceUrl, getEnrollableClasses, reverseStudentPayment, removeStudentFromRoster, requestStudentEdit, collectStudentCharge, type EnrollableClass, type PendingBill, type BackfillDay } from '@/api/students';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dayLabel, formatDayDate, formatNumber, relationshipLabel } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import { Slot } from '@/ui/Slot';
import { SendReportSheet } from '@/components/tickets/SendReportSheet';
import { OpenTicketSheet } from '@/components/tickets/OpenTicketSheet';

/** One person to call: who, the number with who has proved it, call (and report, for a parent). */
function ContactRow({ icon, label, name, phone, badge, empty, onCall, onFlag, divider = false }: {
  icon: 'child' | 'profile'; label: string; name: string | null; phone: string | null;
  badge: { label: string; variant: 'success' | 'info' | 'warning' | 'danger' } | null;
  empty: string; onCall?: () => void; onFlag?: () => void; divider?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: divider ? 1 : 0, borderTopColor: colors.borderLight }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: icon === 'child' ? colors.brandTint : colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={19} color={icon === 'child' ? colors.brand : colors.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary }} numberOfLines={1}>{label}</Text>
        {name ? <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{name}</Text> : null}
        {phone ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: name ? 1 : 0 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: name ? 13 : 15, color: name ? colors.textSecondary : colors.textPrimary, writingDirection: 'ltr' }}>{phone}</Text>
            {badge ? <Badge label={badge.label} variant={badge.variant} size="sm" /> : null}
          </View>
        ) : (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary }}>{empty}</Text>
        )}
      </View>
      {onFlag ? (
        <Surface id="teacher.student_profile.flag_parent_number" assistantNeeds="report_incidents">
        <TouchableOpacity onPress={onFlag} accessibilityRole="button" accessibilityLabel={t('student_profile_ui.flag_number_a11y')}
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.dangerLight, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="warning" size={17} color={colors.danger} />
        </TouchableOpacity>
        </Surface>
      ) : null}
      {onCall ? (
        <Surface id="teacher.student_profile.call_button">
        <TouchableOpacity onPress={onCall} accessibilityRole="button" accessibilityLabel={t('student_profile_ui.call_a11y')}
          style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.successLight, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="call" size={20} color={colors.success} />
        </TouchableOpacity>
        </Surface>
      ) : null}
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

/**
 * A student's whole profile under this teacher — the page at /(teacher)/students/[id], and the
 * same thing in a modal over the collections list (founder 2026-10-06: «like on the student
 * details page»: corrections, paid-before-joining, past attendance and the rest). One
 * component, so the two can never drift apart.
 *
 * With `onClose` it is hosted in a modal: the hero's back closes it, and anything that
 * navigates away closes it first, so the next screen is not left underneath.
 */
export function StudentProfile({ id, onClose, sheet = false, initialName, heroGesture }: {
  id: string; onClose?: () => void;
  /** Hosted in a native sheet: no status bar above the hero, × instead of back, no pull-to-refresh (the pull dismisses). */
  sheet?: boolean;
  /** Android's sheet: dragging the hero down closes it (the scroll below keeps its own gesture). */
  heroGesture?: GestureType;
  /** The name already on screen where the sheet was opened from — the hero shows it while the profile loads. */
  initialName?: string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  // Leave the profile for another screen: from a modal, close it first.
  const go = (href: Href) => { onClose?.(); router.push(href); };
  const { data: s, isLoading, refetch } = useStudentDetail(id);
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const allowanceBlock = useSetStudentAllowanceBlock(Number(id));
  const [exporting, setExporting] = useState(false);
  const [sendReportOpen, setSendReportOpen] = useState(false);
  const [openTicket, setOpenTicket] = useState(false);
  // Cancel a specific collected payment (teacher-only; the server enforces + returns
  // an empty `collected` list for assistants, so the UI is naturally hidden for them).
  const [reversing, setReversing] = useState<number | null>(null);
  const cancelPayment = (c: { kind: 'bill' | 'booklet' | 'booking'; id: number; label: string }) => {
    Alert.alert(t('cash.refuse_confirm'), t('student_profile_ui.cancel_payment_body', { label: c.label }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('cash.refuse_confirm'), style: 'destructive', onPress: async () => {
          setReversing(c.id);
          try { await reverseStudentPayment(id, c.kind, c.id); await refetch(); }
          catch { Alert.alert(t('common.error'), t('student_profile_ui.cancel_payment_failed')); }
          finally { setReversing(null); }
        },
      },
    ]);
  };
  // Collecting straight from the profile (founder 2026-10-06: «teacher and assistant can
  // collect pending collection from profile details»). One sheet for any charge — a bill by
  // its month, a ملزمة, the booking دفعة, or everything at once — with the amount prefilled
  // and editable, because a family often pays part at the door. Same server path as the
  // kiosk (paid_at, receipt, drawer, oversight, audit). Teacher, or an assistant with
  // scan_attendance — the server refuses anyone else.
  const [collectFor, setCollectFor] = useState<CollectTarget | null>(null);
  // null = the full remainder (follows «الكل»), like the collections list's sheet.
  const [collectAmount, setCollectAmount] = useState<string | null>(null);
  const [collectBusy, setCollectBusy] = useState(false);
  const openCollect = (target: CollectTarget) => { setCollectAmount(null); setCollectFor(target); };
  const submitCollect = async () => {
    if (!collectFor || !s) return;
    const parsed = parseCollectAmount(collectAmount ?? String(collectFor.remaining), collectFor);
    if ('error' in parsed) { Alert.alert('', parsed.error); return; }
    setCollectBusy(true);
    try {
      Alert.alert(t('common.done'), await collectTarget(id, collectFor, parsed.amount, s.billing));
      track('payment_collected', { kind: collectFor.kind, value: Math.round(parsed.amount), currency: 'EGP', source: 'profile' });
      setCollectFor(null);
      void qc.invalidateQueries({ queryKey: ['pending-collections'] });
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message || t('student_profile_ui.collect_failed'));
    } finally {
      await refetch();
      setCollectBusy(false);
    }
  };
  const { can, isAssistant } = useActiveAbilities();
  const canManage = can(ABILITY.MANAGE_STUDENTS);
  const canCollect = can(ABILITY.SCAN);
  const canExport = can(ABILITY.EXPORT_REPORTS);

  // The paper register: tick the past days (last 90) this student attended before the
  // app knew them. Presence only — an unticked day stays unrecorded, not absent.
  const [backfillFor, setBackfillFor] = useState<{ enrollmentId: number; courseName: string | null; days: BackfillDay[] } | null>(null);
  const [backfillPicked, setBackfillPicked] = useState<(number | string)[]>([]);
  const [backfillBusy, setBackfillBusy] = useState(false);
  // «تسجيل شهر سابق»: a month before joining — its sessions and its fee, owed now.
  const [priorBillFor, setPriorBillFor] = useState<{ enrollmentId: number; courseName: string | null } | null>(null);
  // «السنة»: the course's year, month by month — bills, sessions, and what each month allows.
  const [yearFor, setYearFor] = useState<BillingYearTarget | null>(null);

  // Attendance from before the app, counted per month (founder 2026-10-06: «a teacher joined in
  // October; the student has attended since September — say how many sessions each month»).
  // History only: it adds to the totals and shows on the course; no cycle or bill moves.
  const openBackfill = (c: { enrollment_id?: number; name: string | null; backfill_days?: BackfillDay[] }) => {
    if (!c.enrollment_id) return;
    setBackfillPicked([]);
    setBackfillFor({ enrollmentId: c.enrollment_id, courseName: c.name, days: c.backfill_days ?? [] });
  };
  // Correcting the bills of one course, one plain statement per month: how much, for how
  // many sessions, and how much of it is paid (founder 2026-10-06: «the assistants got lost»
  // in modes and pickers). The bill itself is edited; the server refuses what it must.
  type BillRow = {
    invoiceId: number | null; month: string | null; sessions: number; threshold: number; neverRan: boolean; overdue: boolean;
    amount: string; sessionsText: string; paid: string; origAmount: number | null; origPaid: number;
  };
  const [amountFor, setAmountFor] = useState<{ enrollmentId: number; courseName: string | null; rows: BillRow[] } | null>(null);
  const [amountBusy, setAmountBusy] = useState(false);
  const setBillRow = (idx: number, patch: Partial<BillRow>) =>
    setAmountFor((f) => (f ? { ...f, rows: f.rows.map((r, k) => (k === idx ? { ...r, ...patch } : r)) } : f));
  const submitAmount = async () => {
    if (!amountFor) return;
    const num = (t: string) => Number(t.replace(/[^\d.]/g, ''));
    // Only the months that were touched are sent.
    const changed = amountFor.rows.filter((r) => {
      const paid = r.paid.trim() === '' ? null : num(r.paid);
      return r.sessionsText.trim() !== '' || r.origAmount == null || Math.abs(num(r.amount) - r.origAmount) > 0.009 || (paid != null && Math.abs(paid - r.origPaid) > 0.009);
    });
    if (changed.length === 0) { setAmountFor(null); return; }
    for (const r of changed) {
      const a = num(r.amount);
      if (!Number.isFinite(a) || a <= 0) { Alert.alert('', r.month ? t('student_profile_ui.enter_valid_amount_for_month', { month: r.month }) : t('student_profile_ui.enter_valid_amount')); return; }
    }
    setAmountBusy(true);
    try {
      for (const r of changed) {
        await setCycleAmount(amountFor.enrollmentId, {
          amount: num(r.amount),
          sessions: r.sessionsText.trim() === '' ? null : Number(r.sessionsText.replace(/[^\d]/g, '')),
          paid: r.paid.trim() === '' ? null : num(r.paid),
          invoiceId: r.invoiceId,
        });
      }
      setAmountFor(null);
      Alert.alert(t('common.done'), changed.length === 1 ? t('student_profile_ui.bill_corrected_one') : t('student_profile_ui.bills_corrected', { count: changed.length }));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message || t('student_profile_ui.bill_correct_failed'));
    } finally {
      await refetch();
      setAmountBusy(false);
    }
  };

  // «سُدِّدت قبل الانضمام» — the month this family paid before the teacher was on the
  // system. For the students a newly joined teacher enrolled before the terms sheet could
  // say so. Settled as prior money, never a collection; an assistant's word is reviewable.
  const [priorFor, setPriorFor] = useState<{ enrollmentId: number; courseName: string | null; remaining: number } | null>(null);
  const [priorAmount, setPriorAmount] = useState('');
  const [priorBusy, setPriorBusy] = useState(false);
  const submitPrior = async () => {
    if (!priorFor) return;
    const typed = priorAmount.trim() === '' ? null : Number(priorAmount.replace(/[^\d.]/g, ''));
    if (typed != null && (!Number.isFinite(typed) || typed <= 0 || typed > priorFor.remaining + 0.001)) {
      Alert.alert('', t('student_profile_ui.prior_amount_between', { max: priorFor.remaining }));
      return;
    }
    setPriorBusy(true);
    try {
      const r = await settleCycleBeforeJoining(priorFor.enrollmentId, typed);
      setPriorFor(null);
      setPriorAmount('');
      await refetch();
      Alert.alert(t('common.done'), r.invoice && r.invoice.remaining > 0
        ? t('student_profile_ui.prior_settled_partial', { applied: Math.round(r.applied), remaining: Math.round(r.invoice.remaining) })
        : t('student_profile_ui.prior_settled_full'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message || t('student_profile_ui.register_failed'));
    } finally {
      setPriorBusy(false);
    }
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
      const parts = [t('student_profile_ui.position_now', { position: r.position, threshold: r.threshold })];
      if (r.repriced) parts.push(r.invoice_amount ? t('student_profile_ui.cycle_bill_reissued', { amount: r.invoice_amount }) : t('student_profile_ui.cycle_bill_cancelled'));
      else if (r.kept_paid) parts.push(t('student_profile_ui.paid_bill_untouched'));
      Alert.alert(t('student_profile_ui.position_set_title'), parts.join('\n'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message || t('student_profile_ui.position_set_failed'));
    } finally {
      setPositionBusy(false);
    }
  };

  const submitBackfill = async () => {
    if (!backfillFor || backfillPicked.length === 0) { Alert.alert('', t('student_profile_ui.pick_one_day')); return; }
    setBackfillBusy(true);
    try {
      const r = await backfillAttendance(backfillFor.enrollmentId, backfillPicked);
      setBackfillFor(null);
      await refetch();
      const parts = [r.created === 1 ? t('student_profile_ui.backfill_created_one', { count: r.created }) : t('student_profile_ui.backfill_created_many', { count: r.created })];
      if (r.moved && r.started_at) parts.push(t('student_profile_ui.backfill_start_moved', { session: r.started_at }));
      if (r.repriced) parts.push(r.invoice_amount ? t('student_profile_ui.cycle_bill_reissued', { amount: r.invoice_amount }) : t('student_profile_ui.cycle_bill_cancelled'));
      else if (r.kept_paid && r.moved) parts.push(t('student_profile_ui.paid_bill_untouched'));
      Alert.alert(t('common.done'), parts.join('\n'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message || t('student_profile_ui.backfill_failed'));
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
    if (!first && !last && !phone) { Alert.alert('', t('student_profile_ui.edit_need_field')); return; }
    if (!reason) { Alert.alert('', t('student_profile_ui.edit_need_reason')); return; }
    setEditBusy(true);
    try {
      await requestStudentEdit(id, { first_name: first || undefined, last_name: last || undefined, phone: phone || undefined, reason });
      setEditOpen(false); setEditFirst(''); setEditLast(''); setEditPhone(''); setEditReason('');
      Alert.alert(t('student_profile_ui.sent_title'), t('student_profile_ui.edit_sent_body'));
    } catch (e: any) {
      Alert.alert(t('student_profile_ui.send_failed_title'), e?.response?.data?.message || t('common.error'));
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
    if (reportDesc.trim().length < 20) { Alert.alert('', t('student_profile_ui.report_desc_short')); return; }
    setReportBusy(true);
    try {
      await reportStudentIncident(id, {
        description: reportDesc.trim(),
        report_type: reportType,
        severity: reportSafety ? 'safety_critical' : 'standard',
        safety_category: reportSafety ? reportSafetyCat : undefined,
      });
      setReportOpen(false); setReportDesc(''); setReportSafety(false); setReportType('behavioral');
      Alert.alert(t('student_profile_ui.sent_title'), t('student_profile_ui.report_sent_body'));
    } catch (e: any) {
      Alert.alert(t('student_profile_ui.send_failed_title'), e?.response?.data?.message || t('common.error'));
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
      Alert.alert(t('student_profile_ui.sent_title'), t('student_profile_ui.flag_sent_body'));
    } catch (e: any) {
      Alert.alert(t('student_profile_ui.send_failed_title'), e?.response?.data?.message || t('common.error'));
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
  // The PDF chip: open / share it here, or send it to the parent inside one of the
  // student's tickets without downloading anything (founder 2026-10-11).
  const choosePerformance = () => {
    if (exporting) return;
    Alert.alert(t('teacher.performance_export'), undefined, [
      { text: t('tickets.pdf_open_here'), onPress: () => { void exportPerformance(); } },
      { text: t('tickets.pdf_send_in_ticket'), onPress: () => setSendReportOpen(true) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

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
      t('student_profile_ui.remove_from_roster_title'),
      t('student_profile_ui.remove_from_roster_body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('form_ui.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeStudentFromRoster(id);
              if (onClose) onClose(); else router.back();
            } catch {
              Alert.alert(t('common.error'), t('student_profile_ui.remove_from_roster_failed'));
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
            let sms;
            try {
              sms = await terminateEnrollment(enrollmentId);
              refetch();
            } catch {
              Alert.alert(t('common.error'), t('teacher.terminate_failed'));
              return;
            }
            // Then ask whether to text the family (nothing is sent unless the teacher says so).
            askRemovalSms(t, enrollmentId, sms);
          },
        },
      ],
    );
  };

  const hero = (
    <Surface id="teacher.student_profile.hero">
    <PageHero
      title={s?.name ?? initialName ?? t('teacher.tab_students')}
      subtitle={s ? [s.grade_name ?? t('teacher.no_grade'), s.student_code].filter(Boolean).join(' · ') : undefined}
      avatar={s ? avatarSeed.student(s.id, s.name ?? '—') : undefined}
      onBack={onClose ?? true}
      closeIcon={sheet}
      grabber={sheet}
      inset={sheet ? spacing.md : undefined}
      action={s && canExport ? { icon: 'download', label: exporting ? '…' : 'PDF', onPress: choosePerformance, accessibilityLabel: t('teacher.performance_export') } : undefined}
      stats={s ? [
        { value: formatNumber(s.attendance_stats.attended), label: t('teacher.stat_attended') },
        { value: formatNumber(s.attendance_stats.absent), label: t('teacher.stat_absent'), warn: s.attendance_stats.absent > 0 },
        { value: s.billing.has_pending ? formatNumber(Number(s.billing.pending_total ?? 0)) : '٠', label: t('student_profile_ui.stat_owed_egp'), warn: !!s.billing.has_pending },
      ] : undefined}
      compact={!s}
    />
    </Surface>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Ink hero: who, and the three numbers a teacher wants before anything else — how
          often they come, how often they do not, and what the family owes. The PDF export
          sits in the hero chip. */}
      {heroGesture ? (
        <GestureDetector gesture={heroGesture}>
          <View collapsable={false}>{hero}</View>
        </GestureDetector>
      ) : hero}

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : !s ? (
        <EmptyState icon="child" title={t('teacher.student_not_found')} />
      ) : (
        <ScrollView
          style={{ marginTop: -spacing.xl4 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={sheet ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Who to call, at the top (founder 2026-10-06: the parents' section moved up beside the
              student's number). The student's OWN number is their login credential and the one a
              teacher rings when the parent does not answer; each number says who (if anyone) has
              proved it, because an unproved number propagates to every other teacher. */}
          <Surface id="teacher.student_profile.contacts_card">
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, ...shadows.sm }}>
            <ContactRow
              icon="child"
              label={t('offline.fields.student_name')}
              name={null}
              phone={s.phone ?? null}
              badge={s.phone ? {
                label: s.phone_verified ? t('teacher.number_verified') : s.phone_vouched ? t('teacher.number_vouched') : t('teacher.number_unproved'),
                variant: s.phone_verified ? 'success' : s.phone_vouched ? 'info' : 'warning',
              } : null}
              empty={t('student_profile_ui.student_no_phone')}
              onCall={s.phone ? () => Linking.openURL(`tel:${s.phone}`) : undefined}
            />
            {s.parents.map((p, i) => (
              <ContactRow
                key={`parent-${p.id ?? i}`}
                divider
                icon="profile"
                label={[relationshipLabel(p.relationship) || t('offline.fields.parent_name'), p.is_primary ? t('teacher.primary_parent') : null].filter(Boolean).join(' · ')}
                name={p.name}
                phone={p.phone}
                // §7: an answered OTP, a teacher's word, or nothing — three claims that never share a badge.
                badge={p.number_flagged
                  ? { label: t('teacher.number_fake'), variant: 'danger' }
                  : p.phone_verified
                    ? { label: t('teacher.number_verified'), variant: 'success' }
                    : p.number_vouched
                      ? { label: t('teacher.number_vouched'), variant: 'info' }
                      : { label: t('teacher.number_unproved'), variant: 'warning' }}
                empty={t('teacher.no_phone')}
                onCall={p.phone ? () => callParent(p.phone!, p.name) : undefined}
                // Report this number as fake/misleading → (assistant: teacher review first →) super-admin review.
                onFlag={canReport && !p.number_flagged ? () => setFlagFor({ id: p.id, name: p.name ?? '—' }) : undefined}
              />
            ))}
            {s.parent_number_notice ? (
              <Surface id="teacher.student_profile.parent_number_notice">
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.dangerLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
                <Icon name="call" size={16} color={colors.dangerText} />
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.dangerText }}>
                  {s.parent_number_notice_message ?? t('teacher.number_fake')}
                </Text>
              </View>
              </Surface>
            ) : null}
          </View>
          </Surface>

          {/* A student who studies with another teacher too, whose number nobody has proved.
              It sits at the top because it is not this teacher's problem alone: a student is
              one global identity, so the digits typed at one door are the digits everyone
              calls. Narrow by construction — the server sends a sentence and a boolean, never
              which teacher, so this screen has nothing to leak even if it wanted to. */}
          {s.shared_unproved_number ? (
            <Surface id="teacher.student_profile.shared_unproved_banner">
            <TouchableOpacity
              onPress={() => go('/(teacher)/phone-confirmations' as Href)}
              accessibilityRole="button"
              activeOpacity={0.85}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                backgroundColor: colors.warningLight, borderRadius: radius.lg,
                borderWidth: 1, borderColor: colors.warning,
                padding: spacing.md, marginTop: spacing.md,
              }}
            >
              <Icon name="call" size={18} color={colors.warningText} />
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: colors.textPrimary }}>
                {s.shared_unproved_message ?? t('student_profile_ui.shared_unproved_fallback')}
              </Text>
              <Icon name="back" size={16} color={colors.warningText} />
            </TouchableOpacity>
            </Surface>
          ) : null}

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

          {/* Quieter actions, one row: a name/phone correction request, an incident report,
              removing a terminated student. Only what this person may do is drawn — each
              button's surface gate says who (the server's ui.gates can widen it). */}
          <Surface id="teacher.student_profile.quick_actions">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
            {/* A ticket with the parent, answered in their app (founder 2026-10-21). */}
            {s.parents.length > 0 ? (
              <Surface id="teacher.student_profile.open_ticket_button" ctx={{ student: s }} assistantNeeds="reply_tickets">
              <TouchableOpacity onPress={() => setOpenTicket(true)} accessibilityRole="button" activeOpacity={0.85}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.brandTint, borderRadius: radius.full, borderWidth: 1, borderColor: colors.brand, paddingVertical: 8, paddingHorizontal: spacing.md }}>
                <Icon name="tickets" size={16} color={colors.brand} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{t('tickets.open_with_parent')}</Text>
              </TouchableOpacity>
              </Surface>
            ) : null}
            <Surface id="teacher.student_profile.edit_request_button" ctx={{ student: s }} assistantNeeds="manage_students">
            <TouchableOpacity onPress={() => setEditOpen(true)} accessibilityRole="button" activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: spacing.md }}>
              <Icon name="note" size={16} color={colors.textSecondary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }}>{t('student_profile_ui.edit_request_action')}</Text>
            </TouchableOpacity>
            </Surface>
            {/* Incident reports: the teacher, or an assistant granted report_incidents (the report
                still lands in the teacher's tenant; the assistant is recorded as who typed it). */}
            <Surface id="teacher.student_profile.report_incident_button" ctx={{ student: s }} assistantNeeds="report_incidents">
            <TouchableOpacity onPress={() => setReportOpen(true)} accessibilityRole="button" activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: spacing.md }}>
              <Icon name="warning" size={16} color={colors.danger} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.danger }}>{t('student_profile_ui.report_incident')}</Text>
            </TouchableOpacity>
            </Surface>
            {s.can_remove_from_roster ? (
              <Surface id="teacher.student_profile.remove_from_roster_button" ctx={{ student: s }} assistantNeeds="manage_students">
              <TouchableOpacity onPress={confirmRemoveFromRoster} accessibilityRole="button" activeOpacity={0.85}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: spacing.md }}>
                <Icon name="person-remove" size={16} color={colors.textSecondary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }}>{t('student_profile_ui.remove_from_roster_title')}</Text>
              </TouchableOpacity>
              </Surface>
            ) : null}
          </View>
          </Surface>

          {/* Billing */}
          <Surface id="teacher.student_profile.billing_section">
          <Section title={t('teacher.billing_section')}>
            {/* The dues card: the total in one glance, then every charge by name — each bill
                by its month, each ملزمة, the booking دفعة — with «تحصيل» on the row and
                «تحصيل الكل» under them. Red when something is overdue, amber when owed, green
                when clear. */}
            <StudentDuesCard billing={s.billing} canCollect={canCollect} onCollect={openCollect} />

            {/* «تصحيح قيمة فاتورة الدورة» — directly under the figure it corrects, and sized
                like a real action rather than a chip: this is what a teacher reaches for with
                a parent standing in front of them, after reading the amount above and finding
                it wrong. The teacher, or an assistant holding «تعديل قيمة فاتورة الطالب» (founder
                2026-10-05; on by default, the server tells the teacher). One button per billable
                enrolment, named by course, so a student in two courses is never ambiguous. */}
            <Surface id="teacher.student_profile.correct_bill_button" ctx={{ student: s }} assistantNeeds="edit_bill_amount">
            {(s.courses ?? []).filter((c) => c.enrollment_id && c.cycle?.has_cycle).map((c) => (
              <TouchableOpacity
                key={`fixamt-${c.enrollment_id}`}
                onPress={() => {
                  const bills = c.correctable_bills ?? [];
                  // Every month still open to a correction, oldest first, as it stands now.
                  const rows: BillRow[] = bills.length > 0
                    ? [...bills].reverse().map((b) => ({
                      invoiceId: b.invoice_id, month: b.month, sessions: b.sessions ?? 0, threshold: b.threshold ?? 0, neverRan: !!b.never_ran, overdue: !b.current,
                      amount: String(b.amount), sessionsText: '', paid: String(b.paid), origAmount: b.amount, origPaid: b.paid,
                    }))
                    : [{
                      invoiceId: null, month: null, sessions: 0, threshold: 0, neverRan: false, overdue: false,
                      amount: c.cycle_invoice ? String(Number(c.cycle_invoice.amount)) : '', sessionsText: '', paid: '0', origAmount: null, origPaid: 0,
                    }];
                  setAmountFor({ enrollmentId: c.enrollment_id!, courseName: c.name, rows });
                }}
                accessibilityRole="button"
                activeOpacity={0.85}
                style={{
                  // Solid fill, not an outline: an outlined control next to a bordered card
                  // reads as another panel. A filled brand button with a chevron is the one
                  // shape nobody has to wonder about.
                  marginTop: spacing.md, minHeight: 54, borderRadius: radius.lg,
                  backgroundColor: colors.brand,
                  flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  ...shadows.sm,
                }}
              >
                <Icon name="money" size={20} color="#fff" />
                <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: '#fff' }} numberOfLines={1}>
                  {(s.courses ?? []).filter((x) => x.enrollment_id && x.cycle?.has_cycle).length > 1
                    ? t('student_profile_ui.correct_bills_course', { course: c.name ?? '' })
                    : t('student_profile_ui.correct_bills')}
                </Text>
                <Icon name="back" size={18} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            ))}
            </Surface>

            {/* «سُدِّدت قبل الانضمام» — one per course bill with money still due. Teacher, or an
                assistant with manage_students (their word lands in the teacher's review bucket).
                Quieter than the correction above: this does not change the figure, it says
                the family already paid it before the system existed. */}
            <Surface id="teacher.student_profile.prior_paid_button" ctx={{ student: s }} assistantNeeds="manage_students">
            {(s.courses ?? []).filter((c) => c.enrollment_id && c.cycle_invoice && Number(c.cycle_invoice.remaining) > 0).map((c) => (
              <TouchableOpacity
                key={`prior-${c.enrollment_id}`}
                onPress={() => { setPriorAmount(''); setPriorFor({ enrollmentId: c.enrollment_id!, courseName: c.name, remaining: Number(c.cycle_invoice!.remaining) }); }}
                accessibilityRole="button"
                activeOpacity={0.85}
                style={{ marginTop: spacing.md, minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brand + '55', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg }}
              >
                <Icon name="success" size={20} color={colors.brand} outline />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }} numberOfLines={1}>
                    {(s.courses ?? []).filter((x) => x.cycle_invoice && Number(x.cycle_invoice.remaining) > 0).length > 1 ? t('student_profile_ui.prior_paid_course', { course: c.name ?? '' }) : t('student_profile_ui.prior_paid_system')}
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
                    {t('student_profile_ui.cycle_bill_amount_remaining', { amount: Math.round(Number(c.cycle_invoice!.amount)), remaining: Math.round(Number(c.cycle_invoice!.remaining)) })}
                  </Text>
                </View>
                <Icon name="back" size={18} color={colors.brand} />
              </TouchableOpacity>
            ))}
            </Surface>

            {/* Price set on a course, but the teacher-wide booklets switch is off — say why there is no button. */}
            {s.billing.booklets_disabled_hint ? (
              <Surface id="teacher.student_profile.booklets_disabled_hint">
              <View style={{ marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
                <Icon name="book" size={18} color={colors.textSecondary} outline />
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
                  {t('student_profile_ui.booklets_disabled_hint')}
                </Text>
              </View>
              </Surface>
            ) : null}

            {/* Per-student 15-day-allowance block — scan_attendance, like the API. */}
            <Surface id="teacher.student_profile.allowance_block_toggle" ctx={{ student: s }} assistantNeeds="scan_attendance">
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
            </Surface>

            {/* Every 15-day exemption this student was given, newest first, with where it
                came from — the screen, the door scan, the kiosk, or a manual check-in at a
                given session (founder 2026-10-04: «track that on the student's profile»). */}
            {(s.billing.exemptions ?? []).length > 0 ? (
              <Surface id="teacher.student_profile.exemptions_list">
              <View style={{ marginTop: spacing.md }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('students_ui.exemptions_title')}</Text>
                {(s.billing.exemptions ?? []).map((x) => (
                  <View key={x.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: x.active ? colors.info : colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                    <Icon name="shield" size={18} color={x.active ? colors.infoText : colors.textTertiary} outline={!x.active} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{x.source_label}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        {[
                          x.granted_at ? formatDayDate(x.granted_at) : null,
                          x.granted_by ? t('students_ui.exemption_by', { name: x.granted_by }) : null,
                          x.session?.course_name ?? null,
                        ].filter(Boolean).join(' · ')}
                      </Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: x.active ? colors.infoText : colors.textTertiary, marginTop: 2 }}>
                        {x.revoked
                          ? t('students_ui.exemption_revoked')
                          : x.active && x.expires_at
                            ? t('teacher.override_until', { date: formatDayDate(x.expires_at) })
                            : t('students_ui.exemption_ended')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              </Surface>
            ) : null}

            {/* Collected payments the teacher can CANCEL (per-charge). */}
            {(s.billing.collected ?? []).length > 0 ? (
              <Surface id="teacher.student_profile.collected_payments">
              <View style={{ marginTop: spacing.md }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('student_profile_ui.collected_payments_title')}</Text>
                {(s.billing.collected ?? []).map((c) => (
                  <View key={`${c.kind}-${c.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>{c.label}</Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.success, marginTop: 2 }}>{t('student_profile_ui.paid_amount', { amount: c.paid })}</Text>
                    </View>
                    <Surface id="teacher.student_profile.cancel_payment_button" ctx={{ student: s }}>
                    <TouchableOpacity onPress={() => cancelPayment(c)} disabled={reversing === c.id} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: spacing.md }}>
                      {reversing === c.id ? <ActivityIndicator size="small" color={colors.danger} /> : <Icon name="close" size={14} color={colors.danger} />}
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.danger }}>{t('cash.refuse_confirm')}</Text>
                    </TouchableOpacity>
                    </Surface>
                  </View>
                ))}
              </View>
              </Surface>
            ) : null}
          </Section>
          </Surface>

          {/* Courses — a card per enrolment (founder 2026-10-06: «the course part needs love; the
              attendance doesn't look tappable»): where the cycle stands as a bar of sessions (tap
              to correct the position), attendance in three numbers, the paper register as a real
              button, and transfer / terminate at the foot. */}
          {s.courses.length > 0 ? (
            <Surface id="teacher.student_profile.courses_section">
            <Section title={t('teacher.student_courses')}>
              <View style={{ gap: spacing.md }}>
                {s.courses.map((c) => {
                  const cy = c.cycle?.has_cycle ? c.cycle : null;
                  const unrecorded = (c.backfill_days ?? []).filter((d) => d.recorded == null).length;
                  const canPosition = canManage && !!c.enrollment_id && !!cy;
                  const openPosition = () => setPositionFor({ enrollmentId: c.enrollment_id!, courseName: c.name, position: cy!.position, threshold: cy!.threshold, positions: c.timeline_positions ?? [] });
                  // A private lesson (attendance_mode 'none', founder 2026-10-12) tracks no attendance:
                  // no attended / absent numbers, no paper register. Position and held stay.
                  const noDoor = c.tracks_attendance === false;
                  return (
                    <View key={c.id} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, overflow: 'hidden', ...shadows.sm }}>
                      {/* Name */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.md }}>
                        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="book" size={20} color={colors.brand} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }} numberOfLines={2}>{c.name ?? '—'}</Text>
                          {noDoor ? (
                            <Surface id="teacher.student_profile.course_private_label" ctx={{ student: s, course: c }}>
                            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.accentText, marginTop: 2 }} numberOfLines={2}>{c.attendance_label ?? t('course_ui.private_marks_only')}</Text>
                            </Surface>
                          ) : null}
                        </View>
                      </View>

                      {cy ? (
                        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
                          {/* Where the cycle stands: a bar of the cycle's sessions, the current one marked. */}
                          <Surface id="teacher.student_profile.cycle_position_bar">
                          <TouchableOpacity onPress={openPosition} disabled={!canPosition} activeOpacity={0.8} accessibilityRole="button"
                            accessibilityLabel={t('student_profile_ui.session_n_of', { position: cy.position, threshold: cy.threshold })}
                            style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{t('student_profile_ui.cycle_position_label')}</Text>
                              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('student_profile_ui.session_n_of', { position: formatNumber(cy.position), threshold: formatNumber(cy.threshold) })}</Text>
                              {canPosition ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginStart: spacing.sm, backgroundColor: colors.brandTint, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
                                  <Icon name="note" size={12} color={colors.brand} />
                                  <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.brand }}>{t('student_profile_ui.edit')}</Text>
                                </View>
                              ) : null}
                            </View>
                            <View style={{ flexDirection: 'row', gap: 3 }}>
                              {Array.from({ length: Math.max(1, cy.threshold) }).map((_, i) => {
                                const n = i + 1;
                                const before = n <= cy.carried;
                                const done = n < cy.position;
                                const now = n === cy.position;
                                return (
                                  <View key={i} style={{ flex: 1, height: 8, borderRadius: 4,
                                    backgroundColor: before ? colors.border : done ? colors.brand : now ? colors.accent : colors.surface,
                                    borderWidth: done || now || before ? 0 : 1, borderColor: colors.border }} />
                                );
                              })}
                            </View>
                            {cy.carried > 0 ? (
                              <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 6 }}>{t('student_profile_ui.joined_from_session', { session: formatNumber(cy.carried + 1) })}</Text>
                            ) : null}
                          </TouchableOpacity>
                          </Surface>

                          {/* Attendance in this cycle, in three numbers — a private lesson keeps only «held». */}
                          <Surface id="teacher.student_profile.cycle_stats" ctx={{ student: s, course: c }}>
                          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                            {[
                              ...(noDoor ? [] : [
                                { v: cy.attended, l: t('student_profile_ui.attended'), fg: colors.successText, bg: colors.successLight },
                                { v: cy.absent, l: t('student_profile_ui.absent'), fg: cy.absent > 0 ? colors.dangerText : colors.textSecondary, bg: cy.absent > 0 ? colors.dangerLight : colors.surfaceSunken },
                              ]),
                              { v: cy.held, l: t('student_profile_ui.sessions_held'), fg: colors.textPrimary, bg: colors.surfaceSunken },
                            ].map((x) => (
                              <View key={x.l} style={{ flex: 1, backgroundColor: x.bg, borderRadius: radius.lg, paddingVertical: spacing.sm, alignItems: 'center' }}>
                                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: x.fg }}>{formatNumber(x.v)}</Text>
                                <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary }}>{x.l}</Text>
                              </View>
                            ))}
                          </View>
                          </Surface>
                        </View>
                      ) : null}

                      {/* The paper register: days held with no record for this student. */}
                      {c.enrollment_id && unrecorded > 0 && !noDoor ? (
                        <Surface id="teacher.student_profile.backfill_button" ctx={{ student: s, course: c }} assistantNeeds="mark_attendance_manual">
                        <TouchableOpacity onPress={() => openBackfill(c)} accessibilityRole="button" activeOpacity={0.85}
                          style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, paddingHorizontal: spacing.md }}>
                          <Icon name="calendar" size={18} color={colors.brand} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('student_profile_ui.backfill_action')}</Text>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('student_profile_ui.backfill_sub', { count: formatNumber(unrecorded) })}</Text>
                          </View>
                          <Icon name="back" size={16} color={colors.brand} />
                        </TouchableOpacity>
                        </Surface>
                      ) : null}

                      {/* The year of this course, month by month (founder 2026-10-08). */}
                      {c.enrollment_id ? (
                        <Surface id="teacher.student_profile.year_calendar_button" ctx={{ student: s }}>
                        <TouchableOpacity onPress={() => setYearFor({ studentId: Number(s.id), name: s.name, enrollmentId: c.enrollment_id! })} accessibilityRole="button" activeOpacity={0.85}
                          style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, paddingHorizontal: spacing.md }}>
                          <Icon name="calendar" size={18} color={colors.brand} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('student_profile_ui.year_calendar')}</Text>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('student_profile_ui.year_calendar_sub')}</Text>
                          </View>
                          <Icon name="back" size={16} color={colors.brand} />
                        </TouchableOpacity>
                        </Surface>
                      ) : null}

                      {/* A month before joining, recorded whole: its sessions and its fee, owed now
                          (founder 2026-10-08). Money → who may manage students. */}
                      {c.enrollment_id ? (
                        <Surface id="teacher.student_profile.prior_month_button" ctx={{ student: s }} assistantNeeds="manage_students">
                        <TouchableOpacity onPress={() => setPriorBillFor({ enrollmentId: c.enrollment_id!, courseName: c.name })} accessibilityRole="button" activeOpacity={0.85}
                          style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.warningDark, paddingHorizontal: spacing.md }}>
                          <Icon name="invoices" size={18} color={colors.warningDark} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.warningDark }}>{t('student_profile_ui.prior_month')}</Text>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('student_profile_ui.prior_month_sub')}</Text>
                          </View>
                          <Icon name="back" size={16} color={colors.warningDark} />
                        </TouchableOpacity>
                        </Surface>
                      ) : null}

                      {/* Transfer / terminate — manage_students, per button. */}
                      {c.enrollment_id ? (
                        <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingTop: spacing.md }}>
                          <Surface id="teacher.student_profile.transfer_button" ctx={{ student: s }} assistantNeeds="manage_students">
                          <TouchableOpacity
                            onPress={() => setTransferFor({ enrollmentId: c.enrollment_id!, courseId: c.id, courseName: c.name })}
                            accessibilityRole="button" accessibilityLabel={t('teacher.transfer_title')} activeOpacity={0.85}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42, backgroundColor: colors.brandTint, borderRadius: radius.lg }}
                          >
                            <Icon name="transfer" size={16} color={colors.brand} />
                            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.transfer_action')}</Text>
                          </TouchableOpacity>
                          </Surface>
                          <Surface id="teacher.student_profile.terminate_button" ctx={{ student: s }} assistantNeeds="manage_students">
                          <TouchableOpacity
                            onPress={() => confirmTerminate(c.name, c.enrollment_id)}
                            accessibilityRole="button" accessibilityLabel={t('teacher.terminate_title')} activeOpacity={0.85}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42, backgroundColor: colors.dangerLight, borderRadius: radius.lg }}
                          >
                            <Icon name="trash" size={15} color={colors.danger} />
                            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.danger }}>{t('teacher.terminate_action')}</Text>
                          </TouchableOpacity>
                          </Surface>
                        </View>
                      ) : <View style={{ height: spacing.lg }} />}
                    </View>
                  );
                })}
              </View>
            </Section>
            </Surface>
          ) : null}

          {/* Attendance history */}
          {/* Recent sessions recordable in place (✓ / ✗, a tap for the rest and the mark),
              then the older records — the session sheet's rows, for one student. */}
          <Surface id="teacher.student_profile.attendance_section">
          <Section title={t('teacher.attendance_history')}>
            <StudentAttendanceList studentId={Number(s.id)} sessions={s.quick_sessions ?? []} history={s.attendance}
              isAssistant={isAssistant} onChanged={() => { void refetch(); }} beforeNavigate={onClose} />
          </Section>
          </Surface>
          <Slot id="teacher.student_profile.bottom" ctx={{ student: s }} style={{ marginTop: spacing.xl }} />
        </ScrollView>
      )}

      {/* Transfer picker: move this enrollment to another of the teacher's courses. */}
      {/* «الطالب على الحصة N» — pick the number, see the day it fell on. */}
      {/* Collect: what, how much (editable — part-payment at the door is normal), and what
          follows (receipt, drawer, reports). */}
      <Surface id="teacher.student_profile.prior_month_sheet"><PriorMonthSheet target={priorBillFor} onClose={() => setPriorBillFor(null)} onSaved={() => { void refetch(); }} /></Surface>
      <Surface id="teacher.student_profile.year_sheet"><BillingYearSheet target={yearFor} onClose={() => { setYearFor(null); void refetch(); }} /></Surface>
      <Surface id="teacher.student_profile.collect_sheet">
      <CollectSheet
        visible={!!collectFor}
        onClose={() => setCollectFor(null)}
        title={collectFor?.label ?? ''}
        name={s?.name ?? undefined}
        owed={collectFor?.remaining ?? 0}
        amount={collectAmount}
        onAmount={setCollectAmount}
        locked={collectFor?.kind === 'all'}
        busy={collectBusy}
        onSubmit={submitCollect}
        hint={collectFor?.kind === 'all' ? t('student_profile_ui.collect_all_hint') : undefined}
      />
      </Surface>

      {/* Correct the bills of one course: a card per month — the amount, how many sessions it
          buys, how much of it is paid — prefilled as the bill stands, so the one wrong number
          is the only thing to type. */}
      <Surface id="teacher.student_profile.correct_bills_sheet">
      {s ? (
        <Surface id="teacher.student_profile.send_report_sheet" ctx={{ student: s }}>
          <SendReportSheet visible={sendReportOpen} onClose={() => setSendReportOpen(false)} studentId={Number(s.id)} studentName={s.name ?? ''} />
          <OpenTicketSheet visible={openTicket} onClose={() => setOpenTicket(false)} studentId={Number(s.id)} studentName={s.name ?? ''} parents={s.parents} />
        </Surface>
      ) : null}

      <SheetModal visible={!!amountFor} onClose={() => !amountBusy && setAmountFor(null)} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>
                {t('student_profile_ui.correct_bills_course', { course: amountFor?.courseName ?? '' })}
              </Text>
              <TouchableOpacity onPress={() => !amountBusy && setAmountFor(null)} hitSlop={10}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginBottom: spacing.md }}>
              {t('student_profile_ui.correct_bills_intro')}
            </Text>
            {(amountFor?.rows ?? []).map((r, idx) => {
              const field = (label: string, value: string, onChange: (v: string) => void, keyboard: 'numeric' | 'number-pad', placeholder?: string) => (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary, marginBottom: 3 }}>{label}</Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    keyboardType={keyboard}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textTertiary}
                    style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, minHeight: 44, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, textAlign: 'center', backgroundColor: colors.surface }}
                  />
                </View>
              );
              return (
                <View key={r.invoiceId ?? 'open'} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, padding: spacing.md, marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                    <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }}>{r.month ?? t('student_profile_ui.current_cycle_bill')}</Text>
                    {r.threshold ? (
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: r.neverRan ? colors.dangerText : colors.textSecondary }}>
                        {r.neverRan ? t('student_profile_ui.attended_of_never_ran', { sessions: r.sessions, threshold: r.threshold }) : t('student_profile_ui.attended_of', { sessions: r.sessions, threshold: r.threshold })}
                      </Text>
                    ) : null}
                    {r.overdue ? <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.dangerText }}>{t('collections.overdue')}</Text> : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {field(t('expenses.amount'), r.amount, (v) => setBillRow(idx, { amount: v }), 'numeric')}
                    {field(t('student_profile_ui.for_sessions'), r.sessionsText, (v) => setBillRow(idx, { sessionsText: v }), 'number-pad', r.threshold ? String(r.threshold) : '—')}
                    {field(t('student_profile_ui.paid_of_it'), r.paid, (v) => setBillRow(idx, { paid: v }), 'numeric')}
                  </View>
                </View>
              );
            })}
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: spacing.xs }}>
              {t('student_profile_ui.correct_bills_paid_note')}
            </Text>
            <TouchableOpacity
              onPress={submitAmount}
              disabled={amountBusy}
              accessibilityRole="button"
              style={{ marginTop: spacing.lg, minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' }}
            >
              {amountBusy ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('common.save')}</Text>
              )}
            </TouchableOpacity>
      </SheetModal>
      </Surface>

      {/* «سُدِّدت قبل الانضمام»: say plainly what it does and does not do, then one optional
          number. Blank = the whole remaining bill. */}
      <Surface id="teacher.student_profile.prior_paid_sheet">
      <SheetModal visible={!!priorFor} onClose={() => !priorBusy && setPriorFor(null)} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>
                {t('student_profile_ui.prior_paid_course', { course: priorFor?.courseName ?? '' })}
              </Text>
              <TouchableOpacity onPress={() => !priorBusy && setPriorFor(null)} hitSlop={10}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginBottom: spacing.md }}>
              {t('student_profile_ui.prior_intro', { remaining: Math.round(priorFor?.remaining ?? 0) })}
            </Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>
              {t('student_profile_ui.prior_amount_label')}
            </Text>
            <TextInput
              value={priorAmount}
              onChangeText={setPriorAmount}
              keyboardType="numeric"
              placeholder={`${Math.round(priorFor?.remaining ?? 0)}`}
              placeholderTextColor={colors.textTertiary}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, minHeight: 48, fontFamily: fonts.medium, fontSize: 16, color: colors.textPrimary, textAlign: 'right' }}
            />
            <TouchableOpacity
              onPress={submitPrior}
              disabled={priorBusy}
              accessibilityRole="button"
              style={{ marginTop: spacing.lg, minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center' }}
            >
              {priorBusy ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('student_profile_ui.prior_submit')}</Text>
              )}
            </TouchableOpacity>
      </SheetModal>
      </Surface>

      <Surface id="teacher.student_profile.position_sheet">
      <SheetModal visible={!!positionFor} onClose={() => !positionBusy && setPositionFor(null)} style={{ backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('student_profile_ui.position_title', { course: positionFor?.courseName ?? '' })}</Text>
              <TouchableOpacity onPress={() => !positionBusy && setPositionFor(null)} hitSlop={10}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginBottom: spacing.sm }}>
              {t('student_profile_ui.position_intro')}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
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
                      {pos?.label ?? '—'}{pos && !pos.is_past ? `  · ${t('session_ui.upcoming')}` : ''}
                    </Text>
                    {current ? <Badge label={t('student_profile_ui.current')} variant="info" size="sm" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {positionBusy ? <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.brand} /> : null}
      </SheetModal>
      </Surface>

      {/* The paper register — past days of one course, tick who came. */}
      <Surface id="teacher.student_profile.backfill_sheet">
      <SheetModal visible={!!backfillFor} onClose={() => !backfillBusy && setBackfillFor(null)} style={{ backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('student_profile_ui.backfill_title')}</Text>
              <TouchableOpacity onPress={() => !backfillBusy && setBackfillFor(null)} hitSlop={10}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
              {t('student_profile_ui.backfill_intro', { course: backfillFor?.courseName ?? '' })}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.sm }}>
              {t('student_profile_ui.backfill_note')}
            </Text>
            <TouchableOpacity onPress={() => setBackfillPicked((backfillFor?.days ?? []).filter((d) => d.recorded == null).map((d) => d.id))} style={{ alignSelf: 'flex-start', marginBottom: spacing.xs }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.brand }}>{t('student_profile_ui.backfill_select_all')}</Text>
            </TouchableOpacity>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {(backfillFor?.days ?? []).map((d) => {
                const locked = d.recorded != null;
                const on = locked ? (d.recorded === 'present' || d.recorded === 'late') : backfillPicked.includes(d.id);
                const tag = locked ? ({ present: t('attendance.present'), late: t('attendance.late'), absent: t('attendance.absent'), excused: t('attendance.excused') } as Record<string, string>)[d.recorded!] ?? d.recorded : (d.virtual ? t('student_profile_ui.per_schedule') : (d.before_enrolment ? t('student_profile_ui.before_enrolment') : t('student_profile_ui.no_record')));
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
              {backfillBusy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('student_profile_ui.backfill_submit', { count: backfillPicked.length })}</Text>}
            </TouchableOpacity>
      </SheetModal>
      </Surface>

      <Surface id="teacher.student_profile.transfer_sheet">
      <SheetModal visible={!!transferFor} onClose={() => !transferBusy && setTransferFor(null)} style={{ backgroundColor: colors.background, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '75%' }}>
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
                        <Icon name="back" size={18} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                );
              })()
            )}

            {transferBusy ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.sm }} /> : null}
      </SheetModal>
      </Surface>

      {/* Name/phone correction request → super-admin review */}
      <Surface id="teacher.student_profile.edit_request_sheet">
      <SheetModal visible={editOpen} onClose={() => !editBusy && setEditOpen(false)} avoidKeyboard style={{ backgroundColor: colors.background, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '88%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('student_profile_ui.edit_request_title')}</Text>
              <TouchableOpacity onPress={() => !editBusy && setEditOpen(false)} hitSlop={10}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              {t('student_profile_ui.edit_request_intro')}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.md }}>
              {[
                { label: t('student_profile_ui.first_name'), value: editFirst, set: setEditFirst, kb: 'default' as const },
                { label: t('student_profile_ui.last_name'), value: editLast, set: setEditLast, kb: 'default' as const },
                { label: t('auth.phone'), value: editPhone, set: setEditPhone, kb: 'phone-pad' as const },
              ].map((f) => (
                <View key={f.label} style={{ marginBottom: spacing.md }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>{f.label}</Text>
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
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('student_profile_ui.edit_reason_label')}</Text>
                <TextInput
                  value={editReason}
                  onChangeText={setEditReason}
                  multiline
                  placeholder={t('student_profile_ui.edit_reason_ph')}
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
                {editBusy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('student_profile_ui.send_for_review')}</Text>}
              </TouchableOpacity>
            </ScrollView>
      </SheetModal>
      </Surface>

      {/* Incident report → super-admin review (teacher-only) */}
      <Surface id="teacher.student_profile.report_incident_sheet">
      <SheetModal visible={reportOpen} onClose={() => !reportBusy && setReportOpen(false)} avoidKeyboard style={{ backgroundColor: colors.background, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '90%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('student_profile_ui.report_incident')}</Text>
              <TouchableOpacity onPress={() => !reportBusy && setReportOpen(false)} hitSlop={10}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              {t('student_profile_ui.report_intro')}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('student_profile_ui.report_type_label')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
                {([['behavioral', t('student_profile_ui.type_behavioral')], ['communication', t('student_profile_ui.type_communication')], ['attendance_discipline', t('student_profile_ui.type_discipline')], ['other', t('student_profile_ui.other')]] as [IncidentType, string][]).map(([val, label]) => (
                  <TouchableOpacity key={val} onPress={() => setReportType(val)} activeOpacity={0.85}
                    style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: reportType === val ? colors.brand : colors.border, backgroundColor: reportType === val ? colors.brandTint : colors.surface }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: reportType === val ? colors.brand : colors.textSecondary }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('student_profile_ui.report_desc_label')}</Text>
              <TextInput value={reportDesc} onChangeText={setReportDesc} multiline placeholder={t('student_profile_ui.report_desc_ph')} placeholderTextColor={colors.textTertiary}
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 96, textAlignVertical: 'top', fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.md }} />

              <Surface id="teacher.student_profile.report_safety_toggle">
              <TouchableOpacity onPress={() => setReportSafety((v) => !v)} activeOpacity={0.85}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: reportSafety ? colors.dangerLight : colors.surface, borderWidth: 1.5, borderColor: reportSafety ? colors.danger : colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
                <Icon name="warning" size={18} color={reportSafety ? colors.danger : colors.textTertiary} />
                <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: reportSafety ? colors.danger : colors.textSecondary }}>{t('student_profile_ui.report_safety_toggle')}</Text>
                <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: reportSafety ? colors.danger : colors.border, backgroundColor: reportSafety ? colors.danger : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {reportSafety ? <Icon name="success" size={12} color="#fff" /> : null}
                </View>
              </TouchableOpacity>
              </Surface>

              {reportSafety ? (
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('student_profile_ui.danger_type_label')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {([['weapon', t('student_profile_ui.danger_weapon')], ['physical_violence', t('student_profile_ui.danger_physical_violence')], ['other_immediate_danger', t('student_profile_ui.danger_other_immediate')]] as [SafetyCategory, string][]).map(([val, label]) => (
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
                {reportBusy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('attendance.report_submit')}</Text>}
              </TouchableOpacity>
            </ScrollView>
      </SheetModal>
      </Surface>

      {/* Flag a parent's phone number → super-admin review (teacher-only) */}
      <Surface id="teacher.student_profile.flag_number_sheet">
      <SheetModal visible={!!flagFor} onClose={() => !flagBusy && setFlagFor(null)} avoidKeyboard style={{ backgroundColor: colors.background, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('student_profile_ui.flag_title')}</Text>
              <TouchableOpacity onPress={() => !flagBusy && setFlagFor(null)} hitSlop={10}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              {t('student_profile_ui.flag_intro', { name: flagFor?.name ?? '' })}
            </Text>
            <TextInput value={flagReason} onChangeText={setFlagReason} multiline placeholder={t('teacher.reason_optional')} placeholderTextColor={colors.textTertiary}
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 72, textAlignVertical: 'top', fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.md }} />
            <TouchableOpacity onPress={submitFlag} disabled={flagBusy} activeOpacity={0.85}
              style={{ backgroundColor: colors.danger, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', opacity: flagBusy ? 0.6 : 1 }}>
              {flagBusy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('attendance.report_submit')}</Text>}
            </TouchableOpacity>
      </SheetModal>
      </Surface>
    </View>
  );
}
