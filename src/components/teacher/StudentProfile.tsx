import { SheetModal } from '@/components/ui/SheetModal';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, RefreshControl, Alert, TextInput } from 'react-native';
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
import { StudentDuesCard, CollectForm, collectTarget, parseCollectAmount, type CollectTarget } from '@/components/teacher/StudentDues';
import { avatarSeed } from '@/components/ui/GeneratedAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { StudentAttendanceList } from '@/components/student/StudentAttendanceList';
import { PriorMonthSheet } from '@/components/teacher/PriorMonthSheet';
import { useStudentDetail } from '@/hooks/useStudents';
import { useSetStudentAllowanceBlock } from '@/hooks/useOverrides';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { useAuthStore } from '@/stores/authStore';
import { reportStudentIncident, flagParentNumber, type IncidentType, type SafetyCategory, type CorrectableBill } from '@/api/students';
import { terminateEnrollment, transferEnrollment, backfillAttendance, setCyclePosition, setCycleAmount, settleCycleBeforeJoining, setPriorMonth } from '@/api/enrollments';
import { reportParentUnreachable, getStudentPerformanceUrl, getEnrollableClasses, reverseStudentPayment, removeStudentFromRoster, requestStudentEdit, collectStudentCharge, type EnrollableClass, type PendingBill, type BackfillDay, type PriorMonth } from '@/api/students';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dayLabel, formatDayDate, formatNumber, relationshipLabel } from '@/utils/format';

/** One person to call: who, the number with who has proved it, call (and report, for a parent). */
function ContactRow({ icon, label, name, phone, badge, empty, onCall, onFlag, divider = false }: {
  icon: 'child' | 'profile'; label: string; name: string | null; phone: string | null;
  badge: { label: string; variant: 'success' | 'info' | 'warning' | 'danger' } | null;
  empty: string; onCall?: () => void; onFlag?: () => void; divider?: boolean;
}) {
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
        <TouchableOpacity onPress={onFlag} accessibilityRole="button" accessibilityLabel="الإبلاغ عن الرقم"
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.dangerLight, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="warning" size={17} color={colors.danger} />
        </TouchableOpacity>
      ) : null}
      {onCall ? (
        <TouchableOpacity onPress={onCall} accessibilityRole="button" accessibilityLabel="اتصال"
          style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.successLight, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="call" size={20} color={colors.success} />
        </TouchableOpacity>
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
  // Collecting straight from the profile (founder 2026-10-06: «teacher and assistant can
  // collect pending collection from profile details»). One sheet for any charge — a bill by
  // its month, a ملزمة, the booking دفعة, or everything at once — with the amount prefilled
  // and editable, because a family often pays part at the door. Same server path as the
  // kiosk (paid_at, receipt, drawer, oversight, audit). Teacher, or an assistant with
  // scan_attendance — the server refuses anyone else.
  const [collectFor, setCollectFor] = useState<CollectTarget | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectBusy, setCollectBusy] = useState(false);
  const openCollect = (target: CollectTarget) => { setCollectAmount(String(target.remaining)); setCollectFor(target); };
  const submitCollect = async () => {
    if (!collectFor || !s) return;
    const parsed = parseCollectAmount(collectAmount, collectFor);
    if ('error' in parsed) { Alert.alert('', parsed.error); return; }
    setCollectBusy(true);
    try {
      Alert.alert('تم', await collectTarget(id, collectFor, parsed.amount, s.billing));
      setCollectFor(null);
      void qc.invalidateQueries({ queryKey: ['pending-collections'] });
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message || 'تعذّر التحصيل');
    } finally {
      await refetch();
      setCollectBusy(false);
    }
  };
  const { can, isAssistant } = useActiveAbilities();
  const canManage = can(ABILITY.MANAGE_STUDENTS);
  const canCollect = can(ABILITY.SCAN);
  const canMarkManual = can(ABILITY.MARK_MANUAL);
  const canExport = can(ABILITY.EXPORT_REPORTS);

  // The paper register: tick the past days (last 90) this student attended before the
  // app knew them. Presence only — an unticked day stays unrecorded, not absent.
  const [backfillFor, setBackfillFor] = useState<{ enrollmentId: number; courseName: string | null; days: BackfillDay[] } | null>(null);
  const [backfillPicked, setBackfillPicked] = useState<(number | string)[]>([]);
  const [backfillBusy, setBackfillBusy] = useState(false);
  // «تسجيل شهر سابق»: a month before joining — its sessions and its fee, owed now.
  const [priorBillFor, setPriorBillFor] = useState<{ enrollmentId: number; courseName: string | null } | null>(null);

  // Attendance from before the app, counted per month (founder 2026-10-06: «a teacher joined in
  // October; the student has attended since September — say how many sessions each month»).
  // History only: it adds to the totals and shows on the course; no cycle or bill moves.
  const [priorMonthsFor, setPriorMonthsFor] = useState<{ enrollmentId: number; courseName: string | null; months: PriorMonth[] } | null>(null);
  const [pmMonth, setPmMonth] = useState<string>('');
  const [pmAttended, setPmAttended] = useState('');
  const [pmHeld, setPmHeld] = useState('');
  const [pmBusy, setPmBusy] = useState(false);
  const recentMonths = (() => {
    const out: { key: string; label: string }[] = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push({ key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, label: m.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }) });
    }
    return out;
  })();
  const openPriorMonths = (c: { enrollment_id?: number; name: string | null; prior_months?: PriorMonth[] }) => {
    if (!c.enrollment_id) return;
    const first = recentMonths[1] ?? recentMonths[0];
    const existing = (c.prior_months ?? []).find((m) => m.month === first.key);
    setPmMonth(first.key);
    setPmAttended(existing ? String(existing.attended) : '');
    setPmHeld(existing?.held != null ? String(existing.held) : '');
    setPriorMonthsFor({ enrollmentId: c.enrollment_id, courseName: c.name, months: c.prior_months ?? [] });
  };
  const pickPriorMonth = (key: string) => {
    setPmMonth(key);
    const existing = (priorMonthsFor?.months ?? []).find((m) => m.month === key);
    setPmAttended(existing ? String(existing.attended) : '');
    setPmHeld(existing?.held != null ? String(existing.held) : '');
  };
  const savePriorMonth = async (remove = false) => {
    if (!priorMonthsFor || !pmMonth) return;
    const attended = remove ? 0 : Number(pmAttended.replace(/[^\d]/g, ''));
    const held = pmHeld.trim() === '' ? null : Number(pmHeld.replace(/[^\d]/g, ''));
    if (!remove && (!Number.isFinite(attended) || attended < 1 || attended > 40)) { Alert.alert('', 'اكتب عدد الحصص التي حضرها في الشهر (١ إلى ٤٠).'); return; }
    if (!remove && held != null && held < attended) { Alert.alert('', 'الحصص التي حضرها لا تزيد عن الحصص التي عُقدت.'); return; }
    setPmBusy(true);
    try {
      const r = await setPriorMonth(priorMonthsFor.enrollmentId, pmMonth, attended, remove ? null : held);
      setPriorMonthsFor((f) => (f ? { ...f, months: r.months } : f));
      if (remove) { setPmAttended(''); setPmHeld(''); }
      await refetch();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message || 'تعذّر الحفظ');
    } finally {
      setPmBusy(false);
    }
  };
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
      if (!Number.isFinite(a) || a <= 0) { Alert.alert('', r.month ? `أدخل مبلغًا صحيحًا لفاتورة ${r.month}.` : 'أدخل مبلغًا صحيحًا.'); return; }
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
      Alert.alert('تم', changed.length === 1 ? 'تم تصحيح الفاتورة.' : `تم تصحيح ${changed.length} فواتير.`);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message || 'تعذّر تصحيح الفاتورة');
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
      Alert.alert('', `أدخل مبلغًا بين 1 و ${priorFor.remaining} ج.م، أو اتركه فارغًا لكامل المتبقي.`);
      return;
    }
    setPriorBusy(true);
    try {
      const r = await settleCycleBeforeJoining(priorFor.enrollmentId, typed);
      setPriorFor(null);
      setPriorAmount('');
      await refetch();
      Alert.alert('تم', r.invoice && r.invoice.remaining > 0
        ? `سُجِّل ${Math.round(r.applied)} ج.م كمسدَّد قبل الانضمام؛ المتبقي ${Math.round(r.invoice.remaining)} ج.م يُحصَّل عند المسح.`
        : 'سُجِّلت فاتورة الدورة كمسدَّدة قبل الانضمام للنظام.');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message || 'تعذّر التسجيل');
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
              if (onClose) onClose(); else router.back();
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

  const hero = (
    <PageHero
      title={s?.name ?? initialName ?? t('teacher.tab_students')}
      subtitle={s ? [s.grade_name ?? t('teacher.no_grade'), s.student_code].filter(Boolean).join(' · ') : undefined}
      avatar={s ? avatarSeed.student(s.id, s.name ?? '—') : undefined}
      onBack={onClose ?? true}
      closeIcon={sheet}
      grabber={sheet}
      inset={sheet ? spacing.md : undefined}
      action={s && canExport ? { icon: 'download', label: exporting ? '…' : 'PDF', onPress: exportPerformance, accessibilityLabel: t('teacher.performance_export') } : undefined}
      stats={s ? [
        { value: formatNumber(s.attendance_stats.attended), label: t('teacher.stat_attended') },
        { value: formatNumber(s.attendance_stats.absent), label: t('teacher.stat_absent'), warn: s.attendance_stats.absent > 0 },
        { value: s.billing.has_pending ? formatNumber(Number(s.billing.pending_total ?? 0)) : '٠', label: 'مستحق ج.م', warn: !!s.billing.has_pending },
      ] : undefined}
      compact={!s}
    />
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
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, ...shadows.sm }}>
            <ContactRow
              icon="child"
              label="الطالب"
              name={null}
              phone={s.phone ?? null}
              badge={s.phone ? {
                label: s.phone_verified ? t('teacher.number_verified') : s.phone_vouched ? t('teacher.number_vouched') : t('teacher.number_unproved'),
                variant: s.phone_verified ? 'success' : s.phone_vouched ? 'info' : 'warning',
              } : null}
              empty="لا رقم للطالب — يُتواصل مع ولي الأمر."
              onCall={s.phone ? () => Linking.openURL(`tel:${s.phone}`) : undefined}
            />
            {s.parents.map((p, i) => (
              <ContactRow
                key={`parent-${p.id ?? i}`}
                divider
                icon="profile"
                label={[relationshipLabel(p.relationship) || 'ولي الأمر', p.is_primary ? t('teacher.primary_parent') : null].filter(Boolean).join(' · ')}
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
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.dangerLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
                <Icon name="call" size={16} color={colors.dangerText} />
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.dangerText }}>
                  {s.parent_number_notice_message ?? t('teacher.number_fake')}
                </Text>
              </View>
            ) : null}
          </View>

          {/* A student who studies with another teacher too, whose number nobody has proved.
              It sits at the top because it is not this teacher's problem alone: a student is
              one global identity, so the digits typed at one door are the digits everyone
              calls. Narrow by construction — the server sends a sentence and a boolean, never
              which teacher, so this screen has nothing to leak even if it wanted to. */}
          {s.shared_unproved_number ? (
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
                {s.shared_unproved_message ?? 'هذا الطالب مسجَّل مع معلّم آخر أيضًا، ورقمه لم يُثبَت بعد.'}
              </Text>
              <Icon name="back" size={16} color={colors.warningText} />
            </TouchableOpacity>
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
              removing a terminated student. Only what this person may do is drawn. */}
          {canManage || canReport || (canManage && s.can_remove_from_roster) ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
              {canManage ? (
                <TouchableOpacity onPress={() => setEditOpen(true)} accessibilityRole="button" activeOpacity={0.85}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: spacing.md }}>
                  <Icon name="note" size={16} color={colors.textSecondary} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }}>طلب تعديل الاسم/الرقم</Text>
                </TouchableOpacity>
              ) : null}
              {canReport ? (
                <TouchableOpacity onPress={() => setReportOpen(true)} accessibilityRole="button" activeOpacity={0.85}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: spacing.md }}>
                  <Icon name="warning" size={16} color={colors.danger} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.danger }}>الإبلاغ عن حادثة</Text>
                </TouchableOpacity>
              ) : null}
              {canManage && s.can_remove_from_roster ? (
                <TouchableOpacity onPress={confirmRemoveFromRoster} accessibilityRole="button" activeOpacity={0.85}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: spacing.md }}>
                  <Icon name="person-remove" size={16} color={colors.textSecondary} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }}>إزالة من القائمة</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Billing */}
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
            {can(ABILITY.EDIT_BILL_AMOUNT) ? (s.courses ?? []).filter((c) => c.enrollment_id && c.cycle?.has_cycle).map((c) => (
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
                    ? `تصحيح الفواتير — ${c.name ?? ''}`
                    : 'تصحيح الفواتير'}
                </Text>
                <Icon name="back" size={18} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            )) : null}

            {/* «سُدِّدت قبل الانضمام» — one per course bill with money still due. Teacher, or an
                assistant with manage_students (their word lands in the teacher's review bucket).
                Quieter than the correction above: this does not change the figure, it says
                the family already paid it before the system existed. */}
            {canManage ? (s.courses ?? []).filter((c) => c.enrollment_id && c.cycle_invoice && Number(c.cycle_invoice.remaining) > 0).map((c) => (
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
                    {(s.courses ?? []).filter((x) => x.cycle_invoice && Number(x.cycle_invoice.remaining) > 0).length > 1 ? `سُدِّدت قبل الانضمام — ${c.name ?? ''}` : 'سُدِّدت قبل الانضمام للنظام'}
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
                    {`فاتورة الدورة ${Math.round(Number(c.cycle_invoice!.amount))} ج.م · المتبقي ${Math.round(Number(c.cycle_invoice!.remaining))} ج.م`}
                  </Text>
                </View>
                <Icon name="back" size={18} color={colors.brand} />
              </TouchableOpacity>
            )) : null}

            {/* Price set on a course, but the teacher-wide booklets switch is off — say why there is no button. */}
            {s.billing.booklets_disabled_hint ? (
              <View style={{ marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
                <Icon name="book" size={18} color={colors.textSecondary} outline />
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
                  سعر الملزمة محدّد في المقرر، لكن الملازم غير مفعّلة في إعداداتك. فعّلها من صفحة الفواتير على الويب ليظهر زر «تم تحصيل الملزمة» هنا.
                </Text>
              </View>
            ) : null}

            {/* Per-student 15-day-allowance block — scan_attendance, like the API. */}
            {canCollect ? (
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
            ) : null}

            {/* Every 15-day exemption this student was given, newest first, with where it
                came from — the screen, the door scan, the kiosk, or a manual check-in at a
                given session (founder 2026-10-04: «track that on the student's profile»). */}
            {(s.billing.exemptions ?? []).length > 0 ? (
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
            ) : null}

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

          {/* Courses — a card per enrolment (founder 2026-10-06: «the course part needs love; the
              attendance doesn't look tappable»): where the cycle stands as a bar of sessions (tap
              to correct the position), attendance in three numbers, the paper register as a real
              button, and transfer / terminate at the foot. */}
          {s.courses.length > 0 ? (
            <Section title={t('teacher.student_courses')}>
              <View style={{ gap: spacing.md }}>
                {s.courses.map((c) => {
                  const cy = c.cycle?.has_cycle ? c.cycle : null;
                  const unrecorded = (c.backfill_days ?? []).filter((d) => d.recorded == null).length;
                  const canPosition = canManage && !!c.enrollment_id && !!cy;
                  const openPosition = () => setPositionFor({ enrollmentId: c.enrollment_id!, courseName: c.name, position: cy!.position, threshold: cy!.threshold, positions: c.timeline_positions ?? [] });
                  return (
                    <View key={c.id} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, overflow: 'hidden', ...shadows.sm }}>
                      {/* Name */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.md }}>
                        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="book" size={20} color={colors.brand} />
                        </View>
                        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }} numberOfLines={2}>{c.name ?? '—'}</Text>
                      </View>

                      {cy ? (
                        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
                          {/* Where the cycle stands: a bar of the cycle's sessions, the current one marked. */}
                          <TouchableOpacity onPress={openPosition} disabled={!canPosition} activeOpacity={0.8} accessibilityRole="button"
                            accessibilityLabel={`الحصة ${cy.position} من ${cy.threshold}`}
                            style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>موقعه في الدورة</Text>
                              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{`الحصة ${formatNumber(cy.position)} من ${formatNumber(cy.threshold)}`}</Text>
                              {canPosition ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginStart: spacing.sm, backgroundColor: colors.brandTint, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
                                  <Icon name="note" size={12} color={colors.brand} />
                                  <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.brand }}>تعديل</Text>
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
                              <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 6 }}>{`انضم من الحصة ${formatNumber(cy.carried + 1)} — ما قبلها لا يُحسب عليه`}</Text>
                            ) : null}
                          </TouchableOpacity>

                          {/* Attendance in this cycle, in three numbers. */}
                          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                            {[
                              { v: cy.attended, l: 'حضر', fg: colors.successText, bg: colors.successLight },
                              { v: cy.absent, l: 'غاب', fg: cy.absent > 0 ? colors.dangerText : colors.textSecondary, bg: cy.absent > 0 ? colors.dangerLight : colors.surfaceSunken },
                              { v: cy.held, l: 'حصص عُقدت', fg: colors.textPrimary, bg: colors.surfaceSunken },
                            ].map((x) => (
                              <View key={x.l} style={{ flex: 1, backgroundColor: x.bg, borderRadius: radius.lg, paddingVertical: spacing.sm, alignItems: 'center' }}>
                                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: x.fg }}>{formatNumber(x.v)}</Text>
                                <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary }}>{x.l}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}

                      {/* The paper register: days held with no record for this student. */}
                      {canMarkManual && c.enrollment_id && unrecorded > 0 ? (
                        <TouchableOpacity onPress={() => openBackfill(c)} accessibilityRole="button" activeOpacity={0.85}
                          style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, paddingHorizontal: spacing.md }}>
                          <Icon name="calendar" size={18} color={colors.brand} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>تسجيل حضور سابق</Text>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{`${formatNumber(unrecorded)} يوم بلا سجل — من الدفتر الورقي`}</Text>
                          </View>
                          <Icon name="back" size={16} color={colors.brand} />
                        </TouchableOpacity>
                      ) : null}

                      {/* A month before joining, recorded whole: its sessions and its fee, owed now
                          (founder 2026-10-08). Money → who may manage students. */}
                      {canManage && c.enrollment_id ? (
                        <TouchableOpacity onPress={() => setPriorBillFor({ enrollmentId: c.enrollment_id!, courseName: c.name })} accessibilityRole="button" activeOpacity={0.85}
                          style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.warningDark, paddingHorizontal: spacing.md }}>
                          <Icon name="invoices" size={18} color={colors.warningDark} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.warningDark }}>تسجيل شهر سابق</Text>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>حصص شهر قبل الانضمام وفاتورته المستحقة</Text>
                          </View>
                          <Icon name="back" size={16} color={colors.warningDark} />
                        </TouchableOpacity>
                      ) : null}

                      {/* Attendance from before the app, per month. */}
                      {(c.prior_months ?? []).length > 0 || (canMarkManual && c.enrollment_id) ? (
                        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.accentLight, borderRadius: radius.lg, padding: spacing.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                            <Icon name="clock" size={16} color={colors.accent} />
                            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }}>قبل التطبيق</Text>
                            {canMarkManual && c.enrollment_id ? (
                              <TouchableOpacity onPress={() => openPriorMonths(c)} accessibilityRole="button" activeOpacity={0.85}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5 }}>
                                <Icon name="add" size={13} color={colors.accent} />
                                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.accent }}>{(c.prior_months ?? []).length ? 'تعديل' : 'أضف شهرًا'}</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                          {(c.prior_months ?? []).length > 0 ? (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
                              {(c.prior_months ?? []).map((m) => (
                                <View key={m.month} style={{ backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary }}>
                                    {`${m.label} · ${m.held != null ? `${formatNumber(m.attended)} من ${formatNumber(m.held)}` : `${formatNumber(m.attended)} حصة`}`}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 4 }}>
                              لو كان يحضر معك قبل التطبيق، سجّل عدد حصص كل شهر — يُضاف لحضوره ولا يغيّر أي فاتورة.
                            </Text>
                          )}
                        </View>
                      ) : null}

                      {/* Transfer / terminate. */}
                      {c.enrollment_id && canManage ? (
                        <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingTop: spacing.md }}>
                          <TouchableOpacity
                            onPress={() => setTransferFor({ enrollmentId: c.enrollment_id!, courseId: c.id, courseName: c.name })}
                            accessibilityRole="button" accessibilityLabel={t('teacher.transfer_title')} activeOpacity={0.85}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42, backgroundColor: colors.brandTint, borderRadius: radius.lg }}
                          >
                            <Icon name="transfer" size={16} color={colors.brand} />
                            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.transfer_action')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => confirmTerminate(c.name, c.enrollment_id)}
                            accessibilityRole="button" accessibilityLabel={t('teacher.terminate_title')} activeOpacity={0.85}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42, backgroundColor: colors.dangerLight, borderRadius: radius.lg }}
                          >
                            <Icon name="trash" size={15} color={colors.danger} />
                            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.danger }}>{t('teacher.terminate_action')}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : <View style={{ height: spacing.lg }} />}
                    </View>
                  );
                })}
              </View>
            </Section>
          ) : null}

          {/* Attendance history */}
          {/* Recent sessions recordable in place (✓ / ✗, a tap for the rest and the mark),
              then the older records — the session sheet's rows, for one student. */}
          <Section title={t('teacher.attendance_history')}>
            <StudentAttendanceList studentId={Number(s.id)} sessions={s.quick_sessions ?? []} history={s.attendance}
              canMark={canMarkManual} isAssistant={isAssistant} onChanged={() => { void refetch(); }} beforeNavigate={onClose} />
          </Section>
        </ScrollView>
      )}

      {/* Transfer picker: move this enrollment to another of the teacher's courses. */}
      {/* «الطالب على الحصة N» — pick the number, see the day it fell on. */}
      {/* Collect: what, how much (editable — part-payment at the door is normal), and what
          follows (receipt, drawer, reports). */}
      <PriorMonthSheet target={priorBillFor} onClose={() => setPriorBillFor(null)} onSaved={() => { void refetch(); }} />
      <SheetModal visible={!!collectFor} onClose={() => !collectBusy && setCollectFor(null)} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{`تحصيل — ${collectFor?.label ?? ''}`}</Text>
              <TouchableOpacity onPress={() => !collectBusy && setCollectFor(null)} hitSlop={10}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {collectFor ? <CollectForm target={collectFor} amount={collectAmount} onAmount={setCollectAmount} busy={collectBusy} onSubmit={submitCollect} /> : null}
      </SheetModal>

      {/* Correct the bills of one course: a card per month — the amount, how many sessions it
          buys, how much of it is paid — prefilled as the bill stands, so the one wrong number
          is the only thing to type. */}
      <SheetModal visible={!!amountFor} onClose={() => !amountBusy && setAmountFor(null)} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>
                {`تصحيح الفواتير — ${amountFor?.courseName ?? ''}`}
              </Text>
              <TouchableOpacity onPress={() => !amountBusy && setAmountFor(null)} hitSlop={10}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginBottom: spacing.md }}>
              لكل شهر: المبلغ، وعن كم حصة، وكم دُفع منه حتى الآن. تُعدَّل الفاتورة نفسها — لا تصدر فاتورة جديدة ولا تبقى فاتورة ملغاة.
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
                    <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }}>{r.month ?? 'فاتورة الدورة الحالية'}</Text>
                    {r.threshold ? (
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: r.neverRan ? colors.dangerText : colors.textSecondary }}>
                        {r.neverRan ? `حضر ${r.sessions}/${r.threshold} — مقرر لم يبدأ؟` : `حضر ${r.sessions}/${r.threshold}`}
                      </Text>
                    ) : null}
                    {r.overdue ? <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.dangerText }}>متأخرة</Text> : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {field('المبلغ (ج.م)', r.amount, (v) => setBillRow(idx, { amount: v }), 'numeric')}
                    {field('عن كم حصة', r.sessionsText, (v) => setBillRow(idx, { sessionsText: v }), 'number-pad', r.threshold ? String(r.threshold) : '—')}
                    {field('المدفوع منه', r.paid, (v) => setBillRow(idx, { paid: v }), 'numeric')}
                  </View>
                </View>
              );
            })}
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: spacing.xs }}>
              ما تزيده في «المدفوع» يُسجَّل مدفوعًا دون أن يدخل خزنة. لتقليل المدفوع ألغِ التحصيل من سجل المدفوعات، لا من هنا.
            </Text>
            <TouchableOpacity
              onPress={submitAmount}
              disabled={amountBusy}
              accessibilityRole="button"
              style={{ marginTop: spacing.lg, minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' }}
            >
              {amountBusy ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>حفظ</Text>
              )}
            </TouchableOpacity>
      </SheetModal>

      {/* «سُدِّدت قبل الانضمام»: say plainly what it does and does not do, then one optional
          number. Blank = the whole remaining bill. */}
      <SheetModal visible={!!priorFor} onClose={() => !priorBusy && setPriorFor(null)} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>
                {`سُدِّدت قبل الانضمام — ${priorFor?.courseName ?? ''}`}
              </Text>
              <TouchableOpacity onPress={() => !priorBusy && setPriorFor(null)} hitSlop={10}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginBottom: spacing.md }}>
              {`الأسرة دفعت رسوم هذا الشهر قبل انضمامك للنظام. تُسجَّل الفاتورة كمسدَّدة دون أن تُحسب ضمن المحصَّل أو درج النقدية، وتُصدر فاتورة الشهر القادم كالمعتاد. المتبقي على الفاتورة الآن ${Math.round(priorFor?.remaining ?? 0)} ج.م.`}
            </Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>
              المبلغ المدفوع مسبقًا (اختياري — فارغ = كامل المتبقي)
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
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>تسجيلها كمسدَّدة مسبقًا</Text>
              )}
            </TouchableOpacity>
      </SheetModal>

      <SheetModal visible={!!positionFor} onClose={() => !positionBusy && setPositionFor(null)} style={{ backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{`الطالب على الحصة رقم — ${positionFor?.courseName ?? ''}`}</Text>
              <TouchableOpacity onPress={() => !positionBusy && setPositionFor(null)} hitSlop={10}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginBottom: spacing.sm }}>
              الحصة التي بدأ منها الطالب — ما قبلها لا يُحاسَب عليه. تُعاد تسعير فاتورة الدورة غير المدفوعة تلقائيًا؛ الفواتير المدفوعة لا تتغيّر.
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
                      {pos?.label ?? '—'}{pos && !pos.is_past ? '  · قادمة' : ''}
                    </Text>
                    {current ? <Badge label="الحالية" variant="info" size="sm" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {positionBusy ? <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.brand} /> : null}
      </SheetModal>

      {/* Attendance before the app: pick a month, say how many sessions he attended (and, if
          known, how many the class held). Keyboard-aware: the numbers stay above the keyboard. */}
      <SheetModal visible={!!priorMonthsFor} onClose={() => !pmBusy && setPriorMonthsFor(null)} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{`حضور قبل التطبيق — ${priorMonthsFor?.courseName ?? ''}`}</Text>
              <TouchableOpacity onPress={() => !pmBusy && setPriorMonthsFor(null)} hitSlop={10}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary, marginBottom: spacing.md }}>
              لكل شهر كان يحضر فيه معك قبل التطبيق: كم حصة حضر. يُضاف إلى حضوره ويظهر على المقرر، ولا يغيّر الدورة ولا أي فاتورة.
            </Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginBottom: 6 }}>الشهر</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingBottom: 2 }} style={{ marginBottom: spacing.md, flexGrow: 0 }}>
              {recentMonths.map((m) => {
                const on = pmMonth === m.key;
                const saved = (priorMonthsFor?.months ?? []).find((x) => x.month === m.key);
                return (
                  <TouchableOpacity key={m.key} onPress={() => pickPriorMonth(m.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                    style={{ paddingHorizontal: spacing.md, height: 38, justifyContent: 'center', borderRadius: radius.full, borderWidth: on ? 2 : 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surfaceSunken }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: on ? colors.brand : colors.textSecondary }}>{saved ? `${m.label} ✓` : m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginBottom: 4 }}>حضر كم حصة</Text>
                <TextInput value={pmAttended} onChangeText={setPmAttended} keyboardType="number-pad" placeholder="مثال: ٨" placeholderTextColor={colors.textTertiary}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, height: 50, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, textAlign: 'center', backgroundColor: colors.surface }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginBottom: 4 }}>من كم حصة عُقدت (اختياري)</Text>
                <TextInput value={pmHeld} onChangeText={setPmHeld} keyboardType="number-pad" placeholder="—" placeholderTextColor={colors.textTertiary}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, height: 50, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, textAlign: 'center', backgroundColor: colors.surface }} />
              </View>
            </View>
            <TouchableOpacity onPress={() => savePriorMonth(false)} disabled={pmBusy || pmAttended.trim() === ''} accessibilityRole="button"
              style={{ marginTop: spacing.lg, minHeight: 50, borderRadius: radius.lg, backgroundColor: pmAttended.trim() === '' ? colors.border : colors.brand, justifyContent: 'center', alignItems: 'center' }}>
              {pmBusy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>حفظ الشهر</Text>}
            </TouchableOpacity>
            {(priorMonthsFor?.months ?? []).some((m) => m.month === pmMonth) ? (
              <TouchableOpacity onPress={() => savePriorMonth(true)} disabled={pmBusy} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: spacing.sm, marginTop: 2 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.dangerText }}>حذف هذا الشهر</Text>
              </TouchableOpacity>
            ) : null}
            {(priorMonthsFor?.months ?? []).length > 0 ? (
              <View style={{ marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.sm, gap: 4 }}>
                {(priorMonthsFor?.months ?? []).map((m) => (
                  <TouchableOpacity key={m.month} onPress={() => pickPriorMonth(m.month)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{m.label}</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{m.held != null ? `${formatNumber(m.attended)} من ${formatNumber(m.held)}` : `${formatNumber(m.attended)} حصة`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
      </SheetModal>

      {/* The paper register — past days of one course, tick who came. */}
      <SheetModal visible={!!backfillFor} onClose={() => !backfillBusy && setBackfillFor(null)} style={{ backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '85%' }}>
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
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
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
      </SheetModal>

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

      {/* Name/phone correction request → super-admin review */}
      <SheetModal visible={editOpen} onClose={() => !editBusy && setEditOpen(false)} avoidKeyboard style={{ backgroundColor: colors.background, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '88%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>طلب تعديل بيانات الطالب</Text>
              <TouchableOpacity onPress={() => !editBusy && setEditOpen(false)} hitSlop={10}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              يراجع مدير النظام الطلب قبل تطبيقه. اترك الحقل فارغًا إن لم ترغب بتغييره.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.md }}>
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
      </SheetModal>

      {/* Incident report → super-admin review (teacher-only) */}
      <SheetModal visible={reportOpen} onClose={() => !reportBusy && setReportOpen(false)} avoidKeyboard style={{ backgroundColor: colors.background, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '90%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>الإبلاغ عن حادثة</Text>
              <TouchableOpacity onPress={() => !reportBusy && setReportOpen(false)} hitSlop={10}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              يُراجع مدير النظام البلاغ ولا يظهر لأي معلم آخر إلا بعد اعتماده.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.md }}>
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
      </SheetModal>

      {/* Flag a parent's phone number → super-admin review (teacher-only) */}
      <SheetModal visible={!!flagFor} onClose={() => !flagBusy && setFlagFor(null)} avoidKeyboard style={{ backgroundColor: colors.background, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
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
      </SheetModal>
    </View>
  );
}
