import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Vibration, ActivityIndicator, Dimensions, KeyboardAvoidingView, Alert, type ViewStyle } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { formatMoney } from '@/utils/currency';
import { colors, spacing, radius } from '@/theme/index';
import { scanCard, grantDoorExemption, admitOnce, transferHere, getMyTeachers, type ScanResult, type ScanOffer } from '@/api/teacher';
import { scanRevision, addRevisionGuest } from '@/api/revisions';
import { issueGuestPass } from '@/api/guestPasses';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import * as WebBrowser from 'expo-web-browser';
import { previewPayment, previewAllPayments, collectPayment, waivePayment, type PayKind } from '@/api/payments';
import { useTeacherTodaySessions } from '@/hooks/useTeacherSessions';
import { useReviseMode } from '@/hooks/useReviseMode';
import { bufferScan, deleteScan } from '@/db/offlineScans';
import { useOfflineStore } from '@/stores/offlineStore';
import { useAuthStore, stampTeacherId } from '@/stores/authStore';
import { Icon } from '@/components/ui/Icon';
import { TeacherTip } from '@/components/TeacherTip';
import { PayDuesModal } from '@/components/teacher/PayDuesModal';
import type { ScanPending } from '@/api/teacher';

/** True when a scanned student owes anything (bill / booklet(s) / booking). */
function hasDues(p?: ScanPending | null): boolean {
  return !!p && (!!(p.bill && p.bill.total > 0)
    || (p.booklets?.some((b) => (b.amount ?? 0) > 0) ?? false)
    || !!(p.booking && p.booking.total > 0));
}

const COOLDOWN_MS = 2500; // ignore repeat reads of the SAME card
const SCAN_THROTTLE_MS = 1500; // min gap between ANY two accepted scans (anti-burst)
const FEEDBACK_MS = 1600; // how long the green/red result stays before resuming

// A framed aiming target with bright corner brackets so there's an obvious spot
// to line the student's QR card up against (a plain rectangle read as "nothing to
// aim for"). One bracket per corner; the box itself keeps a faint full outline.
const BRACKET = 38;
const STROKE = 4;
function bracket(pos: 'tl' | 'tr' | 'bl' | 'br'): ViewStyle {
  const s: ViewStyle = { position: 'absolute', width: BRACKET, height: BRACKET, borderColor: '#fff' };
  if (pos === 'tl') return { ...s, top: -STROKE, left: -STROKE, borderTopWidth: STROKE, borderLeftWidth: STROKE, borderTopLeftRadius: 22 };
  if (pos === 'tr') return { ...s, top: -STROKE, right: -STROKE, borderTopWidth: STROKE, borderRightWidth: STROKE, borderTopRightRadius: 22 };
  if (pos === 'bl') return { ...s, bottom: -STROKE, left: -STROKE, borderBottomWidth: STROKE, borderLeftWidth: STROKE, borderBottomLeftRadius: 22 };
  return { ...s, bottom: -STROKE, right: -STROKE, borderBottomWidth: STROKE, borderRightWidth: STROKE, borderBottomRightRadius: 22 };
}

// The aiming frame (must match the on-screen box in the render) plus slack, so a
// card only registers when it's lined up INSIDE the frame — not read from anywhere
// in view.
const FRAME_W = 250;
const FRAME_H = 190;
const FRAME_SLACK = 56;

type Pt = { x: number; y: number };

// Centre of a scanned barcode in view coordinates, from whichever geometry the
// platform reports. Returns null when neither bounds nor cornerPoints are present —
// the caller then can't gate and accepts the read, so scanning never breaks.
function scanCentre(
  bounds?: { origin?: Pt; size?: { width: number; height: number } },
  corners?: Pt[],
): Pt | null {
  if (bounds?.origin && bounds.size && (bounds.size.width > 0 || bounds.size.height > 0)) {
    return { x: bounds.origin.x + bounds.size.width / 2, y: bounds.origin.y + bounds.size.height / 2 };
  }
  if (corners && corners.length > 0) {
    const n = corners.length;
    return { x: corners.reduce((s, p) => s + p.x, 0) / n, y: corners.reduce((s, p) => s + p.y, 0) / n };
  }
  return null;
}

export default function TeacherScan() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    name?: string; id?: string;
    revisionId?: string; revisionInstanceId?: string; revisionTitle?: string; billingMode?: string;
    payKind?: string;
  }>();
  const { data: sessions } = useTeacherTodaySessions();
  const { data: reviseOn } = useReviseMode();
  const online = useOfflineStore((s) => s.online);
  const role = useAuthStore((s) => s.role);
  // Forgiving a debt (waive) is a teacher-only decision; assistants can collect only.
  const canWaive = role === 'teacher';
  // Issuing a guest pass: teacher, or an assistant granted `issue_guest_passes`.
  const { can } = useActiveAbilities();
  const canIssuePass = can(ABILITY.ISSUE_GUEST_PASSES);

  // ---- Revision mode (from the picker) — scan into a specific revision session.
  // Online-only: no offline buffering (guest creation / SMS / spread split can't
  // reconcile from a buffer). Absent params → normal attendance, unchanged.
  const revisionMode = !!params.revisionId && !!params.revisionInstanceId;
  const revisionId = params.revisionId ? Number(params.revisionId) : null;
  const revisionInstanceId = params.revisionInstanceId ? Number(params.revisionInstanceId) : null;
  const isSpread = params.billingMode === 'spread';

  // ---- Payment mode (from the collect picker) — scan a card to collect a bill or
  // booklet. Two steps: preview the amount, then collect after confirmation (the
  // safety layer that makes phone collection acceptable). Online-only. ----
  // `payKind=all` → combined collection: one scan surfaces EVERY due (bill + booklet
  // + booking) in the PayDuesModal. The single-kind values stay for back-compat.
  const payAll = params.payKind === 'all';
  const payKind: PayKind | null =
    params.payKind === 'bill' || params.payKind === 'booklet' || params.payKind === 'booking'
      ? params.payKind
      : null;
  const payMode = payAll || !!payKind;
  const payWhatLabel = payKind === 'bill' ? 'فاتورة' : payKind === 'booklet' ? 'ملزمة' : 'دفعة حجز';

  const currentSessions = (sessions ?? []).filter((s) => s.is_current);
  const sessionName = params.name || (currentSessions.length === 1 ? currentSessions[0].course_name ?? '' : '');

  // Only mount the camera while this screen is focused, so it releases the sensor
  // the moment you navigate away (a tab switch or a pushed screen) instead of
  // rolling in the background.
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  // Safe-lock: locks the SCANNER — while on, no cards are read (the camera preview
  // stays but scanning is paused), so the phone can be set down without picking up
  // stray codes. Tap the lock to engage, HOLD it to release (so a stray tap can't
  // undo it). No code — deliberately simple.
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  // Off-roster guest prompt (revision mode) + the add-by-phone form.
  const [guestPrompt, setGuestPrompt] = useState<{ id: number; name: string } | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [gName, setGName] = useState('');
  const [gPhone, setGPhone] = useState('');
  const [gFee, setGFee] = useState('');
  const [gPaid, setGPaid] = useState(false);
  const [gErr, setGErr] = useState('');
  // Payment confirm popup: what was previewed, held until the teacher taps تأكيد.
  // `owed` is the remaining balance; `payInput` is the amount to collect now
  // (defaults to the full balance; a "pay full" shortcut resets it).
  const [payConfirm, setPayConfirm] = useState<{ name: string; owed: number; paid: number; code: string } | null>(null);
  const [payInput, setPayInput] = useState('');
  // Overdue-bill block: held until the operator grants a 15-day exemption or cancels.
  const [overdueBlock, setOverdueBlock] = useState<{ name: string; message: string; code: string; pending?: ScanPending | null } | null>(null);
  // Same-grade "wrong group" scan → admit once / transfer here.
  const [otherGroup, setOtherGroup] = useState<{ name: string; message: string; cardCode: string; offer: ScanOffer } | null>(null);
  const [otherBusy, setOtherBusy] = useState(false);
  const canManageStudents = can(ABILITY.MANAGE_STUDENTS);
  // Merged pay-on-scan popup: after an attendance scan surfaces dues, open ONE popup
  // listing every kind (bill / booklets / booking) with the paid/remaining + pay-full UI.
  const [duesFor, setDuesFor] = useState<{ code: string; name: string; pending: ScanPending } | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  useEffect(() => {
    const { role, activeTeacherId, setActiveTeacherId } = useAuthStore.getState();
    if (role === 'assistant' && activeTeacherId == null) {
      getMyTeachers()
        .then((res) => { if (res.active_teacher_id != null) setActiveTeacherId(res.active_teacher_id); })
        .catch(() => {});
    }
  }, []);

  const flash = useCallback((success: boolean, message: string, studentName?: string | null, pending?: import('@/api/teacher').ScanPending | null) => {
    Vibration.vibrate(success ? 60 : [0, 120, 90, 120]);
    setFeedback({ success, message, student_name: studentName ?? null, pending: pending ?? null });
    setTimeout(() => { setFeedback(null); setBusy(false); }, FEEDBACK_MS);
  }, []);

  // `locked` pauses scanning too — while the scanner is locked no card is read.
  const paused = locked || !!feedback || busy || !!guestPrompt || phoneOpen || !!payConfirm || !!overdueBlock || !!duesFor || !!otherGroup;

  const handleScan = useCallback(
    async ({ data, bounds, cornerPoints }: { data: string; bounds?: { origin?: Pt; size?: { width: number; height: number } }; cornerPoints?: Pt[] }) => {
      const now = Date.now();
      if (paused) return;
      // Focus gate: only accept a code whose centre is inside the aiming frame, so a
      // card must be lined up in the box — not read from anywhere in the view. When
      // the platform reports no geometry, `scanCentre` is null and we don't gate.
      //
      // IMPORTANT (Samsung/Android): several devices report barcode geometry in the
      // camera-SENSOR coordinate space (e.g. 1080×1920 px), not screen points. Gating
      // those silently drops EVERY read — the scanner "doesn't scan" at all. So we only
      // trust the geometry when the centre lands within the screen; if it's off-screen
      // the space is untrusted and we accept the read rather than gate on bad numbers.
      const centre = scanCentre(bounds, cornerPoints);
      if (centre) {
        const win = Dimensions.get('window');
        const trusted = centre.x >= 0 && centre.y >= 0 && centre.x <= win.width && centre.y <= win.height;
        if (trusted
          && (Math.abs(centre.x - win.width / 2) > FRAME_W / 2 + FRAME_SLACK
            || Math.abs(centre.y - win.height / 2) > FRAME_H / 2 + FRAME_SLACK)) {
          return; // trustworthy coordinates AND outside the frame — ignore silently
        }
      }
      // General throttle: at most one accepted scan per SCAN_THROTTLE_MS regardless
      // of the card, so a burst of reads (or two cards in quick succession) can't
      // fire the handler twice before the feedback pause takes hold.
      if (now - lastRef.current.at < SCAN_THROTTLE_MS) return;
      // Same card: a longer cooldown so the camera re-reading a lingering card is ignored.
      if (data === lastRef.current.code && now - lastRef.current.at < COOLDOWN_MS) return;
      lastRef.current = { code: data, at: now };
      setBusy(true);

      // ---- Combined payment mode: ONE scan → every due in the PayDuesModal. ----
      if (payAll) {
        // Payments are ONLINE-ONLY — never buffered offline (money must be real-time).
        if (!online) {
          flash(false, t('teacher.pay_offline'));
          return;
        }
        try {
          const res = await previewAllPayments(data);
          if (res.success && hasDues(res.pending)) {
            setBusy(false);
            setDuesFor({ code: data, name: (res.student && res.student.name) || '', pending: res.pending! });
            return;
          }
          if (res.success) {
            flash(true, 'لا توجد مستحقات', (res.student && res.student.name) || null);
          } else {
            flash(false, res.message || t('teacher.scan_failed'), (res.student && res.student.name) || null);
          }
        } catch {
          flash(false, t('teacher.scan_failed'));
        }
        return;
      }

      // ---- Payment mode: preview the amount, then hold for confirmation. ----
      if (payMode && payKind) {
        // Payments are ONLINE-ONLY — never buffered offline (money must be real-time).
        // If offline, tell the teacher to reconnect instead of failing silently.
        if (!online) {
          flash(false, t('teacher.pay_offline'));
          return;
        }
        try {
          const res = await previewPayment(payKind, data);
          if (res.success) {
            setBusy(false);
            const owed = Number(res.amount) || 0;
            setPayConfirm({ name: (res.student && res.student.name) || '', owed, paid: Number(res.paid) || 0, code: data });
            setPayInput(owed ? String(owed) : ''); // default to collecting the full balance
            return;
          }
          if (res.code === 'NOTHING_DUE') {
            flash(true, 'لا توجد مستحقات', (res.student && res.student.name) || null);
          } else {
            flash(false, res.message || t('teacher.scan_failed'), (res.student && res.student.name) || null);
          }
        } catch {
          flash(false, t('teacher.scan_failed'));
        }
        return;
      }

      // ---- Revision mode: online-only, no offline buffer. ----
      if (revisionMode && revisionId != null && revisionInstanceId != null) {
        try {
          const res = await scanRevision(revisionId, revisionInstanceId, data);
          if (!res.success && res.code === 'NOT_ON_ROSTER' && res.student) {
            setBusy(false);
            setGuestPrompt(res.student); // hold for the teacher's decision
            return;
          }
          // Revision is cardless: scanning ENROLLS the student into the revision
          // (booking), not an attendance check-in — hence the enrolment wording.
          flash(res.success, res.message || (res.success ? t('teacher.revision_enrolled') : t('teacher.scan_failed')), res.student_name);
        } catch {
          flash(false, t('teacher.scan_failed'));
        }
        return;
      }

      // ---- Regular attendance: buffer offline first, then sync (unchanged). ----
      const scannedAt = new Date().toISOString();
      const teacherId = stampTeacherId(useAuthStore.getState());
      let localId: number | null = null;
      let bufferFailed = false;
      try {
        localId = await bufferScan(data, scannedAt, teacherId);
        await useOfflineStore.getState().refresh();
      } catch {
        // The write to the on-device buffer failed (e.g. storage full). The scan
        // is NOT safely on disk — remember that so we don't later reassure the
        // teacher with a false "saved offline" if the live path also fails (§6).
        bufferFailed = true;
      }

      try {
        const res = await scanCard(data);
        if (localId !== null) {
          await deleteScan(localId);
          await useOfflineStore.getState().refresh();
        }
        // Same-grade "wrong group": the student isn't in this running group but is the
        // same grade → hold on a prompt to admit once or transfer them here.
        if (!res.success && res.code === 'OTHER_GROUP_SAME_GRADE' && res.offer) {
          setBusy(false);
          setOtherGroup({ name: res.student_name ?? '', message: res.message, cardCode: data, offer: res.offer });
          return;
        }
        // Overdue bill → hold on a blocking prompt offering the 15-day exemption,
        // instead of a passing red flash.
        if (!res.success && res.code === 'BILLING_OVERDUE') {
          setBusy(false);
          setOverdueBlock({ name: res.student_name ?? '', message: res.message, code: data, pending: res.pending ?? null });
          return;
        }
        // Passive flags ride along on the auto-dismissing success flash — non-interactive.
        flash(res.success, res.message || (res.success ? t('teacher.checked_in') : t('teacher.scan_failed')), res.student_name, res.pending);
        // Merged pay-on-scan: if the checked-in student owes anything, open ONE popup
        // to collect (bill / booklets / booking) — reversing the old passive-only chips.
        if (res.success && hasDues(res.pending)) {
          setDuesFor({ code: data, name: res.student_name ?? '', pending: res.pending! });
        }
      } catch {
        // Live scan failed (offline). If the buffer write succeeded the scan is
        // safe → reassure. If buffering ALSO failed, nothing was saved anywhere —
        // tell the teacher explicitly so they can rescan/free space (§6), never a
        // false "saved offline".
        if (bufferFailed) {
          Vibration.vibrate([0, 60, 40, 60]);
          setFeedback({ success: false, message: t('teacher.storage_full'), student_name: null });
        } else {
          Vibration.vibrate(40);
          setFeedback({ success: true, message: t('teacher.saved_offline'), student_name: null });
        }
        setTimeout(() => { setFeedback(null); setBusy(false); }, FEEDBACK_MS);
      }
    },
    [paused, payMode, payKind, revisionMode, revisionId, revisionInstanceId, flash, t, online],
  );

  const confirmPay = useCallback(async () => {
    if (!payConfirm || !payKind) return;
    const code = payConfirm.code;
    const amt = Number(payInput);
    // Amount 0 (or cleared) → WAIVE (write-off) the remaining balance instead of
    // collecting. Payment mode is teacher-only, so no extra permission gate is needed.
    // Guarded by a confirm dialog since a waive can't be undone.
    if (!(amt > 0)) {
      const pc = payConfirm;
      Alert.alert(
        t('teacher.waive_confirm_title'),
        t('teacher.waive_confirm_body', { amount: pc.owed, what: payWhatLabel }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('teacher.waive_confirm_yes'),
            style: 'destructive',
            onPress: async () => {
              setPayConfirm(null);
              setBusy(true);
              const res = await waivePayment(payKind, code);
              if (res.success) {
                flash(true, t('teacher.waive_done'), (res.student && res.student.name) || pc.name || null);
              } else if (res.code === 'NOTHING_DUE') {
                flash(true, 'لا توجد مستحقات', (res.student && res.student.name) || null);
              } else {
                flash(false, res.message || t('teacher.scan_failed'), (res.student && res.student.name) || null);
              }
            },
          },
        ],
      );
      return;
    }
    setPayConfirm(null);
    setBusy(true);
    const res = await collectPayment(payKind, code, amt);
    if (res.success) {
      const remaining = Number(res.remaining) || 0;
      flash(
        true,
        remaining > 0
          ? `تم تحصيل ${res.amount} ج.م — المتبقي ${res.remaining} ج.م`
          : 'تم التحصيل بالكامل — أُرسل إشعار SMS',
        (res.student && res.student.name) || null,
      );
    } else if (res.code === 'NOTHING_DUE') {
      flash(true, 'لا توجد مستحقات', (res.student && res.student.name) || null);
    } else {
      flash(false, res.message || t('teacher.scan_failed'), (res.student && res.student.name) || null);
    }
  }, [payConfirm, payKind, payInput, payWhatLabel, flash, t]);

  const confirmExemption = useCallback(async () => {
    if (!overdueBlock) return;
    const code = overdueBlock.code;
    setOverdueBlock(null);
    setBusy(true);
    try {
      // Grant the 15-day exemption at the door (no PIN — teacher or assistant); the
      // server re-runs the scan and checks the student in.
      const res = await grantDoorExemption(code);
      flash(res.success, res.message || (res.success ? t('teacher.checked_in') : t('teacher.scan_failed')), res.student_name);
    } catch {
      flash(false, t('teacher.scan_failed'));
    }
  }, [overdueBlock, flash, t]);

  // Same-grade "wrong group": admit for THIS session only (no enrollment change) or
  // move the student permanently into the running group, then check in.
  const runOtherGroup = useCallback(async (kind: 'once' | 'transfer') => {
    if (!otherGroup || otherBusy) return;
    setOtherBusy(true);
    try {
      const call = kind === 'once' ? admitOnce : transferHere;
      const res = await call(otherGroup.cardCode, otherGroup.offer.target_session_instance_id);
      setOtherGroup(null);
      flash(res.success, res.message || (res.success ? t('teacher.checked_in') : t('teacher.scan_failed')), res.student_name);
    } catch {
      flash(false, t('teacher.scan_failed'));
    } finally {
      setOtherBusy(false);
    }
  }, [otherGroup, otherBusy, flash, t]);

  const confirmGuest = useCallback(async () => {
    if (!guestPrompt || revisionId == null || revisionInstanceId == null) return;
    setBusy(true);
    const student = guestPrompt;
    setGuestPrompt(null);
    const res = await addRevisionGuest(revisionId, revisionInstanceId, student.id);
    flash(res.success, res.message || t('teacher.guest_added'), res.student_name ?? student.name);
  }, [guestPrompt, revisionId, revisionInstanceId, flash, t]);

  // Issue a session-scoped guest pass: name (+ optional phone), an optional flat fee
  // (paid now or pending). On success we open the printable slip (QR + Code128) for an
  // immediate scan, and flash. Phone is OPTIONAL; fee is optional.
  const submitPhone = useCallback(async () => {
    if (revisionId == null || revisionInstanceId == null) return;
    const name = gName.trim();
    const phone = gPhone.trim();
    const feeStr = gFee.trim();
    if (name.length < 2) { setGErr(t('teacher.guest_name')); return; }
    const feeAmount = feeStr === '' ? undefined : Number(feeStr);
    if (feeAmount !== undefined && !(feeAmount >= 0)) { setGErr(t('teacher.guest_fee_invalid')); return; }
    setGErr('');
    setBusy(true);
    const res = await issueGuestPass(revisionId, revisionInstanceId, {
      name,
      phone: phone || undefined,
      feeAmount,
      paidNow: gPaid,
    });
    if (res.success) {
      setPhoneOpen(false); setGName(''); setGPhone(''); setGFee(''); setGPaid(false);
      if (res.slip_url) {
        try { await WebBrowser.openBrowserAsync(res.slip_url); } catch { /* slip is optional to display */ }
      }
      flash(true, res.message || t('teacher.guest_pass_issued'), res.name ?? name);
    } else {
      setBusy(false);
      setGErr(res.message || t('teacher.scan_failed'));
    }
  }, [revisionId, revisionInstanceId, gName, gPhone, gFee, gPaid, flash, t]);

  // Financial (payment) scan mode is never available to an assistant — hard block
  // even on a direct link, regardless of ability config.
  if (payMode && useAuthStore.getState().role === 'assistant') {
    return <Redirect href={'/(teacher)' as Href} />;
  }

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
        <Icon name="scan" size={56} color={colors.brand} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg }}>
          {t('teacher.camera_permission_title')}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
          {t('teacher.camera_permission_body')}
        </Text>
        <TouchableOpacity onPress={requestPermission} activeOpacity={0.85} style={{ marginTop: spacing.xl, backgroundColor: colors.brand, borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.xxl }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }}>{t('teacher.grant_camera')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Attendance-only tip — never in payment or revision scanning modes. */}
      {!payMode && !revisionMode && (
        <TeacherTip
          tip="attendance"
          icon="scan"
          titleKey="onboarding.tip_attendance_title"
          bodyKey="onboarding.tip_attendance_body"
          bulletKeys={['onboarding.tip_attendance_b1', 'onboarding.tip_attendance_b2']}
        />
      )}
      {/* Mounted only while focused — leaving the screen unmounts it and frees the
          camera (it no longer keeps rolling in the background). */}
      {isFocused ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          enableTorch={torch}
          // Dros Spot cards carry ONLY a QR (back) + a Code128 barcode (front), both
          // encoding the same credential. A short list — QR first — makes QR detection
          // reliable (a long mixed list makes the scanner favour the wide barcode and
          // miss QR, especially a QR shown on a screen/PDF).
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128'] }}
          onBarcodeScanned={paused ? undefined : handleScan}
        />
      ) : (
        <View style={{ flex: 1 }} />
      )}

      {/* Header: session / revision / payment context */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: payMode ? 'rgba(11,59,52,0.86)' : revisionMode ? 'rgba(76,29,149,0.82)' : 'rgba(23,28,59,0.72)', flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <TouchableOpacity
          onPress={() => (payMode ? router.replace('/(teacher)/collect' as Href) : revisionMode ? router.replace('/(teacher)/revisions' as Href) : router.replace('/(teacher)' as Href))}
          accessibilityRole="button"
          accessibilityLabel={t('teacher.switch_session')}
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' }}
        >
          <Icon name="forward" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            {payMode ? 'تحصيل الدفعات' : revisionMode ? t('teacher.revision_scanning_for') : t('teacher.scanning_for')}
          </Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }} numberOfLines={1}>
            {payMode ? (payAll ? 'كل المستحقات' : payKind === 'bill' ? 'دفع الفواتير' : payKind === 'booklet' ? 'دفع الملازم' : 'دفع دفعة الحجز') : revisionMode ? (params.revisionTitle || t('teacher.revisions_title')) : (sessionName || t('teacher.scan_mode'))}
          </Text>
          {!revisionMode && !payMode && !online ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.warning }} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.warningLight }}>{t('teacher.offline_saving_local')}</Text>
            </View>
          ) : null}
          {payMode && !online ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger }} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.warningLight }}>{t('teacher.pay_offline_short')}</Text>
            </View>
          ) : null}
        </View>
        {/* Safe-lock toggle — hidden in payment mode (a locked pay screen is unsafe).
            Tap to lock, hold to unlock. */}
        {!payMode ? (
          <TouchableOpacity
            onPress={() => { if (!locked) { setLocked(true); Vibration.vibrate(30); } }}
            onLongPress={() => { if (locked) { setLocked(false); Vibration.vibrate(30); } }}
            delayLongPress={700}
            accessibilityRole="button"
            accessibilityLabel={locked ? 'إلغاء وضع القفل — اضغط مطولاً' : 'تفعيل وضع القفل'}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: locked ? '#b91c1c' : 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' }}
          >
            <Icon name="lock" size={20} color="#fff" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => setTorch((v) => !v)} accessibilityRole="button" accessibilityLabel={t('teacher.torch')} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: torch ? colors.accentWarm : 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="eye" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Scan frame + hint (hidden while the scanner is locked) */}
      {!locked && !feedback && !guestPrompt && !phoneOpen && !payConfirm && !overdueBlock && !otherGroup && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
          <View style={{ width: 250, height: 190, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' }}>
            <View style={bracket('tl')} />
            <View style={bracket('tr')} />
            <View style={bracket('bl')} />
            <View style={bracket('br')} />
          </View>
          <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: '#fff', marginTop: spacing.lg, textAlign: 'center', paddingHorizontal: spacing.xl }}>
            {busy ? t('teacher.checking') : t('teacher.point_camera')}
          </Text>
          {busy ? <ActivityIndicator color="#fff" style={{ marginTop: spacing.md }} /> : null}
        </View>
      )}

      {/* Locked overlay — scanning is paused. The overlay ITSELF is the unlock target:
          hold anywhere to resume (it covers the header, so the header lock button can't
          receive the long-press). Tap does nothing so a stray tap can't unlock. */}
      {locked && !feedback && !guestPrompt && !phoneOpen && !payConfirm && !overdueBlock && !otherGroup ? (
        <TouchableOpacity
          activeOpacity={1}
          onLongPress={() => { setLocked(false); Vibration.vibrate(30); }}
          delayLongPress={700}
          accessibilityRole="button"
          accessibilityLabel="إلغاء وضع القفل — اضغط مطولاً"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}
        >
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="lock" size={48} color="#fff" />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff', marginTop: spacing.lg }}>الماسح مقفل</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: spacing.sm, textAlign: 'center' }}>
            المسح متوقّف — اضغط مطولاً في أي مكان للاستئناف.
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Bottom action: enter the special/exam session picker (when the revision
          switch is on) OR issue a guest pass (already inside a special session, and
          only when the operator may issue one). */}
      {!feedback && !guestPrompt && !phoneOpen && !payMode && !overdueBlock && !otherGroup && (revisionMode ? canIssuePass : reviseOn !== false) ? (
        <TouchableOpacity
          onPress={() => (revisionMode ? (setGErr(''), setPhoneOpen(true)) : router.push('/(teacher)/revisions' as Href))}
          activeOpacity={0.85}
          style={{ position: 'absolute', bottom: insets.bottom + spacing.xxxl, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: revisionMode ? colors.accentWarm : 'rgba(255,255,255,0.16)', borderRadius: radius.full }}
        >
          <Icon name={revisionMode ? 'card' : 'book'} size={18} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>
            {revisionMode ? t('teacher.guest_pass_issue') : t('teacher.revision_open')}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Off-roster guest prompt */}
      {guestPrompt ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(76,29,149,0.96)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <Icon name="child" size={56} color="#fff" />
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: spacing.lg }}>{t('teacher.guest_offroster')}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff', textAlign: 'center', marginTop: 4 }}>{guestPrompt.name}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: spacing.md, textAlign: 'center' }}>
            {isSpread ? t('teacher.guest_billed') : t('teacher.guest_free')}
          </Text>
          <TouchableOpacity onPress={confirmGuest} activeOpacity={0.85} style={{ marginTop: spacing.xl, backgroundColor: '#fff', borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.xxl }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#4c1d95' }}>{t('teacher.guest_add')}</Text>
          </TouchableOpacity>
          {canIssuePass ? (
            <TouchableOpacity onPress={() => { setGuestPrompt(null); setGErr(''); setPhoneOpen(true); }} activeOpacity={0.85} style={{ marginTop: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('teacher.guest_pass_issue')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => { setGuestPrompt(null); setBusy(false); }} activeOpacity={0.85} style={{ marginTop: spacing.lg }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.75)' }}>{t('teacher.guest_ignore')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Payment confirmation — nothing is collected until تأكيد التحصيل. Supports a
          PARTIAL amount (default = full) with a "pay full" shortcut and a live remainder. */}
      {payConfirm ? (
        <KeyboardAvoidingView behavior="padding" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,59,52,0.97)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <Icon name="money" size={48} color="#fff" />
          {payConfirm.name ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff', textAlign: 'center', marginTop: spacing.sm }}>{payConfirm.name}</Text>
          ) : null}
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: spacing.sm }}>
            {`المطلوب تحصيله (${payWhatLabel})`}
          </Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 36, color: '#fff', marginTop: 2 }}>{formatMoney(payConfirm.owed)} ج.م</Text>
          {payConfirm.paid > 0 ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>مدفوع سابقًا: {formatMoney(payConfirm.paid)} ج.م</Text>
          ) : null}

          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: spacing.lg, alignSelf: 'stretch', textAlign: 'center' }}>المبلغ المُحصَّل الآن</Text>
          <TextInput
            value={payInput}
            onChangeText={setPayInput}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="rgba(0,0,0,0.4)"
            style={{ marginTop: spacing.sm, alignSelf: 'stretch', backgroundColor: '#fff', borderRadius: radius.lg, height: 54, fontFamily: fonts.bold, fontSize: 22, color: '#111', textAlign: 'center' }}
          />
          <TouchableOpacity onPress={() => setPayInput(String(payConfirm.owed))} activeOpacity={0.85} style={{ marginTop: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff', textDecorationLine: 'underline' }}>دفع بالكامل</Text>
          </TouchableOpacity>

          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: spacing.md }}>
            المتبقي بعد الدفع: {formatMoney(Math.max(0, payConfirm.owed - (Number(payInput) || 0)))} ج.م
          </Text>

          {/* Amount > 0 → collect; amount 0/cleared → waive (write-off, teacher-only mode). */}
          <TouchableOpacity onPress={confirmPay} disabled={Number.isNaN(Number(payInput))} activeOpacity={0.85} style={{ marginTop: spacing.lg, backgroundColor: '#fff', borderRadius: radius.lg, minHeight: 54, justifyContent: 'center', paddingHorizontal: spacing.xxl }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: Number(payInput) > 0 ? '#0b3b34' : '#92400E' }}>{Number(payInput) > 0 ? 'تأكيد التحصيل' : t('teacher.waive_button')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPayConfirm(null)} activeOpacity={0.85} style={{ marginTop: spacing.md }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.75)' }}>إلغاء</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      ) : null}

      {/* Overdue-bill block — cannot check in; offer an in-the-moment 15-day exemption */}
      {overdueBlock ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(146,64,14,0.97)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <Icon name="warning" size={56} color="#fff" />
          {overdueBlock.name ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff', textAlign: 'center', marginTop: spacing.md }}>{overdueBlock.name}</Text>
          ) : null}
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: '#fff', marginTop: spacing.md }}>دفعة متأخرة</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 4, textAlign: 'center', paddingHorizontal: spacing.lg }}>
            {overdueBlock.message || 'لا يمكن تسجيل الحضور بسبب وجود مستحقات متأخرة.'}
          </Text>
          {/* Primary: collect the overdue dues now (pay → re-scan to check in). */}
          {hasDues(overdueBlock.pending) ? (
            <TouchableOpacity
              onPress={() => {
                const b = overdueBlock;
                setOverdueBlock(null);
                setDuesFor({ code: b.code, name: b.name, pending: b.pending! });
              }}
              activeOpacity={0.85}
              style={{ marginTop: spacing.xl, backgroundColor: '#fff', borderRadius: radius.lg, minHeight: 54, justifyContent: 'center', paddingHorizontal: spacing.xxl }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#92400E' }}>تحصيل المستحقات الآن</Text>
            </TouchableOpacity>
          ) : null}
          {/* Secondary: waive with a 15-day exemption + check in. */}
          <TouchableOpacity onPress={confirmExemption} activeOpacity={0.85} style={{ marginTop: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff', textDecorationLine: 'underline' }}>منح إعفاء 15 يومًا وتسجيل الحضور</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setOverdueBlock(null); setBusy(false); }} activeOpacity={0.85} style={{ marginTop: spacing.lg }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.75)' }}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Same-grade "wrong group": admit for this session only, or transfer here */}
      {otherGroup ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(23,16,43,0.97)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <Icon name="children" size={52} color="#fff" />
          {otherGroup.name ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff', textAlign: 'center', marginTop: spacing.md }}>{otherGroup.name}</Text>
          ) : null}
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: spacing.sm, textAlign: 'center', paddingHorizontal: spacing.lg }}>
            {otherGroup.message}
          </Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: spacing.sm, textAlign: 'center' }}>
            {`${otherGroup.offer.current_course_name ?? '—'}  ←  ${otherGroup.offer.target_course_name ?? '—'}`}
          </Text>

          {otherBusy ? (
            <ActivityIndicator color="#fff" style={{ marginTop: spacing.xl }} />
          ) : (
            <>
              {/* Primary: admit for THIS session only (billing stays with their group). */}
              <TouchableOpacity
                onPress={() => runOtherGroup('once')}
                activeOpacity={0.85}
                style={{ marginTop: spacing.xl, backgroundColor: '#fff', borderRadius: radius.lg, minHeight: 54, justifyContent: 'center', paddingHorizontal: spacing.xxl }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.brand }}>{t('teacher.other_group_once')}</Text>
              </TouchableOpacity>

              {/* Secondary: permanently move them into this group (roster change). */}
              {canManageStudents ? (
                <TouchableOpacity
                  onPress={() => Alert.alert(t('teacher.other_group_transfer'), t('teacher.other_group_transfer_confirm'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('teacher.other_group_transfer'), onPress: () => runOtherGroup('transfer') },
                  ])}
                  activeOpacity={0.85}
                  style={{ marginTop: spacing.lg }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff', textDecorationLine: 'underline' }}>{t('teacher.other_group_transfer')}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity onPress={() => { setOtherGroup(null); setBusy(false); }} activeOpacity={0.85} style={{ marginTop: spacing.lg }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.75)' }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : null}

      {/* Issue-guest-pass form (name + optional phone + optional flat fee) */}
      {phoneOpen ? (
        <KeyboardAvoidingView behavior="padding" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(23,16,43,0.97)', justifyContent: 'center', padding: spacing.xl }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff', textAlign: 'center' }}>{t('teacher.guest_pass_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: spacing.sm }}>{t('teacher.guest_pass_hint')}</Text>
          <TextInput
            value={gName}
            onChangeText={setGName}
            placeholder={t('teacher.guest_name')}
            placeholderTextColor="rgba(0,0,0,0.4)"
            style={{ marginTop: spacing.xl, backgroundColor: '#fff', borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 54, fontFamily: fonts.medium, fontSize: 18, color: '#111', textAlign: 'center' }}
          />
          <TextInput
            value={gPhone}
            onChangeText={setGPhone}
            placeholder={t('teacher.guest_pass_phone_optional')}
            placeholderTextColor="rgba(0,0,0,0.4)"
            keyboardType="phone-pad"
            style={{ marginTop: spacing.md, backgroundColor: '#fff', borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 54, fontFamily: fonts.medium, fontSize: 18, color: '#111', textAlign: 'center' }}
          />
          <TextInput
            value={gFee}
            onChangeText={setGFee}
            placeholder={t('teacher.guest_pass_fee_optional')}
            placeholderTextColor="rgba(0,0,0,0.4)"
            keyboardType="numeric"
            style={{ marginTop: spacing.md, backgroundColor: '#fff', borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 54, fontFamily: fonts.medium, fontSize: 18, color: '#111', textAlign: 'center' }}
          />
          <TouchableOpacity onPress={() => setGPaid((v) => !v)} activeOpacity={0.8} style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#fff', backgroundColor: gPaid ? '#fff' : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
              {gPaid ? <Icon name="success" size={18} color={colors.accentWarm} /> : null}
            </View>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: '#fff' }}>{t('teacher.guest_pass_paid_now')}</Text>
          </TouchableOpacity>
          {gErr ? <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.warningLight, textAlign: 'center', marginTop: spacing.md }}>{gErr}</Text> : null}
          <TouchableOpacity onPress={submitPhone} disabled={busy} activeOpacity={0.85} style={{ marginTop: spacing.xl, backgroundColor: colors.accentWarm, borderRadius: radius.lg, minHeight: 54, justifyContent: 'center', alignItems: 'center' }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('teacher.guest_pass_submit')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setPhoneOpen(false); setGErr(''); setBusy(false); }} activeOpacity={0.85} style={{ marginTop: spacing.md, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.75)' }}>{t('teacher.guest_cancel')}</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      ) : null}

      {/* Full-screen success/failure flash */}
      {feedback ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: feedback.success ? 'rgba(31,147,102,0.96)' : 'rgba(203,58,76,0.96)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }} pointerEvents="none">
          <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name={feedback.success ? 'success' : 'warning'} size={64} color="#fff" />
          </View>
          {feedback.student_name ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 30, color: '#fff', textAlign: 'center', marginTop: spacing.lg }}>{feedback.student_name}</Text>
          ) : null}
          <Text style={{ fontFamily: fonts.medium, fontSize: 19, lineHeight: 28, color: '#fff', textAlign: 'center', marginTop: spacing.sm }}>
            {feedback.message || (feedback.success ? t('teacher.checked_in') : t('teacher.scan_failed'))}
          </Text>
          {/* PASSIVE flags — a reminder only. No buttons; auto-dismisses with the flash.
              Collection happens later on the Pending Collections screen, never here. */}
          {feedback.success && feedback.pending && (feedback.pending.bill || !!feedback.pending.booklets?.length || feedback.pending.booking) ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: spacing.lg }}>
              {feedback.pending.bill ? (
                <PendingChip text={feedback.pending.bill.escalated ? t('teacher.flag_bill_escalated') : (feedback.pending.bill.overdue ? t('teacher.flag_bill_overdue') : t('teacher.flag_bill_due'))} />
              ) : null}
              {feedback.pending.booklets?.length ? (
                <PendingChip text={t('teacher.flag_booklet') + (feedback.pending.booklets.length > 1 ? ` (${feedback.pending.booklets.length})` : '')} />
              ) : null}
              {feedback.pending.booking ? <PendingChip text={t('teacher.flag_booking') + (feedback.pending.booking.secures ? ` — ${feedback.pending.booking.secures}` : '')} /> : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Merged pay-on-scan popup — collect all of the student's dues in one place. */}
      <PayDuesModal
        visible={!!duesFor}
        card={duesFor?.code ?? ''}
        name={duesFor?.name ?? ''}
        pending={duesFor?.pending ?? null}
        online={online}
        canWaive={canWaive}
        onClose={() => { setDuesFor(null); setBusy(false); }}
      />
    </View>
  );
}

/** Passive "has pending" pill shown on the scan-result flash — non-interactive. */
function PendingChip({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 }}>
      <Icon name="money" size={14} color="#fff" />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{text}</Text>
    </View>
  );
}
