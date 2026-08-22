import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Vibration, Keyboard } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import {
  getEnrollableClasses,
  lookupStudent,
  enrollByCard,
  type EnrollableClass,
  type LookupStudent,
  type BookingSecures,
} from '@/api/students';
import {
  scanPreCard,
  confirmPreCard,
  cancelPreCard,
  type PreCardScanStudent,
} from '@/api/preCardInvitation';
import { sendPrecardPhone } from '@/api/precardPhone';
import { TeacherTip } from '@/components/TeacherTip';

type Review =
  | { kind: 'match'; student: LookupStudent; value: string }
  | { kind: 'precard'; invitationId: number; student: PreCardScanStudent }
  | { kind: 'miss' }
  | null;

export default function TeacherEnroll() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { data: classes, isLoading } = useQuery({ queryKey: ['enrollable-classes'], queryFn: getEnrollableClasses });

  // Enrollment is on the COURSE (schedule master) — pick the course, not a session.
  const [course, setCourse] = useState<EnrollableClass | null>(null);
  const [review, setReview] = useState<Review>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  // §3 — invite an already-registered, card-less student by phone (family accepts).
  const [phoneMode, setPhoneMode] = useState(false);
  const [phone, setPhone] = useState('');
  // Optional — used only when the number is a brand-new family (no existing
  // student): it names the invited student on the invitation + SMS. Ignored when
  // the number already belongs to a card-less student.
  const [studentName, setStudentName] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [downPaid, setDownPaid] = useState('');
  const [secures, setSecures] = useState<BookingSecures>('flat');
  const [dpAuto, setDpAuto] = useState(true); // amount is auto-prefilled until the teacher edits it
  const [sending, setSending] = useState(false);

  // The phone-invite sheet is an absolute bottom overlay on the camera, so a
  // KeyboardAvoidingView can't wrap it — track the keyboard height and lift the
  // sheet by it so the phone/amount inputs never sit behind the keyboard.
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Adopt the teacher's default "secures" kind when a course is picked.
  useEffect(() => {
    if (course) { setSecures(course.booking_secures_default); setDpAuto(true); }
  }, [course]);

  // Prefill the amount from the chosen basis (unless the teacher typed one).
  useEffect(() => {
    if (!course || !dpAuto) return;
    const basis = secures === 'session' ? course.price_session : secures === 'booklet' ? course.price_booklet : course.price_flat;
    setDownPayment(basis && basis > 0 ? String(basis) : '');
  }, [course, secures, dpAuto]);

  // Live remainder for the prepayment field — the figure the family's app will show.
  const dpTotalNum = Number(downPayment) || 0;
  const dpPaidNum = Number(downPaid) || 0;
  const dpOverpaid = dpPaidNum > dpTotalNum && dpTotalNum > 0;
  const dpPaidHint = dpOverpaid
    ? t('invites.paid_now_over')
    : dpTotalNum > 0 && dpPaidNum > 0
      ? t('invites.paid_now_remaining').replace('{amount}', (dpTotalNum - dpPaidNum).toFixed(2))
      : t('invites.paid_now_hint');

  const submitPhoneInvite = async () => {
    if (!course || phone.trim().length < 6 || sending) return;
    setSending(true);
    try {
      const r = await sendPrecardPhone({
        phone: phone.trim(),
        course_id: course.course_id,
        academic_session_id: course.academic_session_id,
        ...(studentName.trim() ? { invited_student_name: studentName.trim() } : {}),
        // Typed amount = per-invite down-payment; blank = teacher/course default.
        ...(downPayment.trim()
          ? {
              down_payment_amount: Number(downPayment.trim()),
              down_payment_paid: downPaid.trim() ? Number(downPaid.trim()) : null,
              booking_secures: secures,
            }
          : {}),
      });
      setPhoneMode(false);
      setPhone('');
      setStudentName('');
      setDownPayment('');
      setDownPaid('');
      setDpAuto(true);
      if (r.action === 'use_card') {
        Alert.alert(t('invites.use_card_title'), t('invites.use_card_body'));
      } else if (r.action === 'already_enrolled') {
        Alert.alert(t('invites.already_enrolled_title'), r.message ?? t('invites.already_enrolled_body'));
      } else {
        // Neutral by design (phone-oracle safe): the invite reaches the family in-app
        // AND by SMS, but the per-send status isn't returned on this endpoint.
        Alert.alert(t('invites.sent_title'), t('invites.sent_body'));
      }
    } catch {
      Alert.alert('خطأ', 'تعذّر إرسال الدعوة. حاول مرة أخرى.');
    } finally {
      setSending(false);
    }
  };

  const ready = !!course;

  const handleScan = useCallback(
    async ({ data }: { data: string }) => {
      const now = Date.now();
      if (busy || review || done || !course) return;
      if (data === lastRef.current.code && now - lastRef.current.at < 2500) return;
      lastRef.current = { code: data, at: now };
      setBusy(true);
      try {
        // 1. Is this a parent-generated pre-card invitation token? (structurally
        //    distinct from a card code — server reserves it and returns the student.)
        try {
          const pre = await scanPreCard(data);
          Vibration.vibrate(50);
          setReview({ kind: 'precard', invitationId: pre.invitation_id, student: pre.student });
          return;
        } catch (e: any) {
          const code = e?.response?.data?.code;
          // A real pre-card conflict must surface, not be retried as a card.
          if (code === 'RESERVED_ELSEWHERE' || code === 'TEACHER_ONLY') {
            Alert.alert('', e?.response?.data?.message || 'تعذّر استخدام هذا الرمز');
            return;
          }
          // INVALID_TOKEN / anything else → fall through to a normal card scan.
        }

        // 2. Otherwise treat it as a physical card (QR/serial).
        const res = await lookupStudent('qr', data, course.course_id);
        Vibration.vibrate(50);
        setReview(res.found && res.student ? { kind: 'match', student: res.student, value: data } : { kind: 'miss' });
      } catch {
        Alert.alert('', 'تعذّر البحث. حاول مرة أخرى.');
      } finally {
        setBusy(false);
      }
    },
    [busy, review, done, course],
  );

  const enroll = useMutation({
    mutationFn: (vars: { value: string; acceptGradeMismatch?: boolean }) =>
      enrollByCard({
        method: 'qr',
        value: vars.value,
        course_id: course!.course_id,
        academic_session_id: course!.academic_session_id,
        accept_grade_mismatch: vars.acceptGradeMismatch,
      }),
  });

  // Pre-card: confirm the reserved token → enrollment (spec §5). Consumption
  // happens server-side only on this commit.
  const confirmPre = useMutation({
    mutationFn: (invitationId: number) =>
      confirmPreCard(invitationId, {
        course_id: course!.course_id,
        academic_session_id: course!.academic_session_id,
      }),
  });

  const flashDone = (name: string) => {
    setReview(null);
    setDone(name);
    setTimeout(() => setDone(null), 1800);
  };

  const accept = () => {
    if (!review) return;
    if (review.kind === 'match') {
      const name = review.student.name;
      const value = review.value;
      const run = (acceptGradeMismatch?: boolean) =>
        enroll.mutate({ value, acceptGradeMismatch }, {
          onSuccess: () => flashDone(name),
          onError: (e: any) => {
            // Grade-mismatch confirm: the student's saved grade differs from the
            // course's — ask, then re-enroll accepting the mismatch.
            if (e?.response?.status === 409 && e?.response?.data?.code === 'GRADE_MISMATCH') {
              Alert.alert(t('enroll.grade_mismatch_title'), e?.response?.data?.message || '', [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('enroll.enroll_anyway'), onPress: () => run(true) },
              ]);
              return;
            }
            Alert.alert('', e?.response?.data?.message || 'تعذّر التسجيل');
          },
        });
      run();
    } else if (review.kind === 'precard') {
      const name = review.student.name;
      confirmPre.mutate(review.invitationId, {
        onSuccess: () => flashDone(name),
        onError: (e: any) => Alert.alert('', e?.response?.data?.message || 'تعذّر التسجيل'),
      });
    }
  };

  // Backing out of a pre-card review releases the reservation so the family's
  // one-time code isn't wasted (spec §5.4).
  const dismiss = () => {
    if (review?.kind === 'precard') {
      cancelPreCard(review.invitationId).catch(() => {});
    }
    setReview(null);
  };

  // ---- Camera permission gate ----
  if (!permission) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  if (!permission.granted && ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
        <Icon name="scan" size={56} color={colors.brand} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg }}>نحتاج إذن الكاميرا</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
          لمسح رمز QR على بطاقة الطالب وتسجيله في المقرر.
        </Text>
        <TouchableOpacity onPress={requestPermission} activeOpacity={0.85} style={{ marginTop: spacing.xl, backgroundColor: colors.brand, borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.xxl }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }}>السماح بالكاميرا</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---- Step 1: pick the course (schedule master) ----
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <TeacherTip
          tip="invitation"
          icon="add"
          titleKey="onboarding.tip_invitation_title"
          bodyKey="onboarding.tip_invitation_body"
          bulletKeys={['onboarding.tip_invitation_b1', 'onboarding.tip_invitation_b2']}
        />
        <View style={{ padding: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="forward" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary }}>تسجيل طالب</Text>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, marginTop: spacing.md }}>
            اختر المقرر، ثم امسح رمز QR على بطاقة الطالب أو رمز الدعوة الذي أنشأه ولي الأمر. يُسجَّل في المقرر ويحضر جميع حصصه.
          </Text>
        </View>
        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm }}>
            {(classes ?? []).length === 0 ? (
              <Text style={{ fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>
                لا توجد مقررات لها مواعيد. أضِف موعدًا للمقرر أولًا.
              </Text>
            ) : (
              (classes ?? []).map((c) => (
                <TouchableOpacity
                  key={c.course_id}
                  activeOpacity={0.7}
                  onPress={() => setCourse(c)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{c.course_name}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                      {c.slots.length} {c.slots.length === 1 ? 'موعد أسبوعي' : 'مواعيد أسبوعية'}
                    </Text>
                  </View>
                  <Icon name="back" size={18} color={colors.brand} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}
      </View>
    );
  }

  // ---- Step 2: scan + review ----
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13'] }}
        onBarcodeScanned={busy || review || done || phoneMode ? undefined : handleScan}
      />

      {/* Top bar: chosen course + change */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: 'rgba(23,28,59,0.72)', flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <TouchableOpacity onPress={() => { setCourse(null); setReview(null); }} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>التسجيل في المقرر</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }} numberOfLines={1}>{course!.course_name}</Text>
        </View>
      </View>

      {/* Scan frame */}
      {!review && !done && !phoneMode ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
          <View style={{ width: 240, height: 240, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 24 }} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: '#fff', marginTop: spacing.lg }}>
            {busy ? 'جارٍ البحث…' : 'وجّه الكاميرا نحو رمز QR على البطاقة'}
          </Text>
          {busy ? <ActivityIndicator color="#fff" style={{ marginTop: spacing.md }} /> : null}
        </View>
      ) : null}

      {/* §3 — "invite by phone" (already-registered, card-less student) */}
      {!review && !done && !phoneMode ? (
        <TouchableOpacity
          onPress={() => setPhoneMode(true)}
          activeOpacity={0.85}
          style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: insets.bottom + spacing.xl, minHeight: 52, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm }}
        >
          <Icon name="phone" size={18} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('invites.by_phone')}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Phone-entry overlay — lifts above the keyboard (bottom = keyboard height). */}
      {phoneMode ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ position: 'absolute', left: 0, right: 0, bottom: kbHeight, maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: (kbHeight > 0 ? spacing.xl : insets.bottom + spacing.xl), gap: spacing.md }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('invites.by_phone')}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('invites.phone_label')}</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="01xxxxxxxxx"
            placeholderTextColor={colors.textTertiary}
            style={{ fontFamily: fonts.regular, fontSize: 17, minHeight: 52, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingHorizontal: spacing.lg, color: colors.textPrimary, textAlign: 'left', borderWidth: 1.5, borderColor: phone ? colors.brand : colors.border }}
          />
          {/* Optional student name — used only when this is a brand-new family (an
              unknown number). For a card-less student already on the system it's
              ignored (their own name is used), so it's never required. */}
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('invites.name_label')}</Text>
          <TextInput
            value={studentName}
            onChangeText={setStudentName}
            placeholder={t('invites.name_ph')}
            placeholderTextColor={colors.textTertiary}
            maxLength={120}
            style={{ fontFamily: fonts.regular, fontSize: 17, minHeight: 52, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingHorizontal: spacing.lg, color: colors.textPrimary, textAlign: 'right', borderWidth: 1.5, borderColor: colors.border }}
          />
          {/* Optional per-invite booking down-payment. What it secures is selectable
              (default = the teacher's setting); the amount prefills from that basis.
              Blank = teacher/course default. */}
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('invites.secures_label')}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['session', 'booklet', 'flat'] as BookingSecures[]).map((k) => (
              <TouchableOpacity key={k} onPress={() => { setSecures(k); setDpAuto(true); }} activeOpacity={0.85}
                style={{ flex: 1, minHeight: 44, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, backgroundColor: secures === k ? colors.brandTint : colors.surfaceSunken, borderColor: secures === k ? colors.brand : colors.border }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: secures === k ? colors.brand : colors.textSecondary }}>{t(`invites.secures_${k}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('invites.down_payment_label')}</Text>
          <TextInput
            value={downPayment}
            onChangeText={(v) => { setDownPayment(v); setDpAuto(false); }}
            keyboardType="numeric"
            placeholder={t('invites.down_payment_ph')}
            placeholderTextColor={colors.textTertiary}
            style={{ fontFamily: fonts.regular, fontSize: 17, minHeight: 52, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingHorizontal: spacing.lg, color: colors.textPrimary, textAlign: 'right', borderWidth: 1.5, borderColor: colors.border }}
          />
          {/* Prepayment taken now — only meaningful once a دفعة amount is set. */}
          {downPayment.trim() ? (
            <>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('invites.paid_now_label')}</Text>
              <TextInput
                value={downPaid}
                onChangeText={setDownPaid}
                keyboardType="numeric"
                placeholder={t('invites.paid_now_ph')}
                placeholderTextColor={colors.textTertiary}
                style={{ fontFamily: fonts.regular, fontSize: 17, minHeight: 52, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingHorizontal: spacing.lg, color: colors.textPrimary, textAlign: 'right', borderWidth: 1.5, borderColor: colors.border }}
              />
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: dpOverpaid ? colors.warning : colors.textTertiary }}>
                {dpPaidHint}
              </Text>
            </>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
            <TouchableOpacity onPress={() => { setPhoneMode(false); setPhone(''); setDownPayment(''); setDpAuto(true); }} activeOpacity={0.85}
              style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textSecondary }}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={submitPhoneInvite} disabled={phone.trim().length < 6 || sending} activeOpacity={0.85}
              style={{ flex: 2, backgroundColor: colors.brand, borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', alignItems: 'center', opacity: phone.trim().length < 6 || sending ? 0.5 : 1 }}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('invites.send')}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : null}

      {/* Review card — accept / reject */}
      {review ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
          {review.kind === 'precard' ? (
            <>
              <View style={{ alignSelf: 'flex-start', marginBottom: spacing.sm }}>
                <Badge text="دعوة بواسطة ولي الأمر — قبل البطاقة" color={colors.brand} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary }}>{review.student.name}</Text>
              {review.student.grade ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>{review.student.grade}</Text>
              ) : null}
              {review.student.report_flag ? <FlagChip flag={review.student.report_flag} /> : null}
              {review.student.report_notice && review.student.report_notice_message ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.warning, marginTop: spacing.md }}>
                  {review.student.report_notice_message}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
                <TouchableOpacity onPress={dismiss} activeOpacity={0.85} style={{ flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.danger }}>رفض</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={accept} disabled={confirmPre.isPending} activeOpacity={0.85} style={{ flex: 2, backgroundColor: colors.success, borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', alignItems: 'center' }}>
                  {confirmPre.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>قبول وتسجيل</Text>}
                </TouchableOpacity>
              </View>
            </>
          ) : review.kind === 'match' ? (
            <>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary }}>{review.student.name}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
                <Badge text={review.student.has_card ? 'لديه بطاقة' : 'بدون بطاقة'} color={review.student.has_card ? colors.success : colors.textSecondary} />
              </View>
              {/* Cross-tenant disclosure: a confirmed report's colored flag (label +
                  color); legacy confirmed-without-flag falls back to the fixed notice. */}
              {review.student.report_flag ? <FlagChip flag={review.student.report_flag} /> : null}
              {review.student.report_notice && review.student.report_notice_message ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.danger, marginTop: spacing.md }}>
                  {review.student.report_notice_message}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
                <TouchableOpacity onPress={dismiss} activeOpacity={0.85} style={{ flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.danger }}>رفض</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={accept} disabled={enroll.isPending} activeOpacity={0.85} style={{ flex: 2, backgroundColor: colors.success, borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', alignItems: 'center' }}>
                  {enroll.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>قبول وتسجيل</Text>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>لا يوجد طالب بهذه البطاقة</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs }}>تأكد من البطاقة وأعد المسح.</Text>
              <TouchableOpacity onPress={() => setReview(null)} activeOpacity={0.85} style={{ marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.lg, minHeight: 50, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>إعادة المسح</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : null}

      {/* Success flash */}
      {done ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(31,147,102,0.96)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }} pointerEvents="none">
          <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="success" size={64} color="#fff" />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff', textAlign: 'center', marginTop: spacing.lg }}>{done}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 18, color: '#fff', marginTop: spacing.sm }}>تم التسجيل في المقرر</Text>
        </View>
      ) : null}
    </View>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: 10 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color }}>{text}</Text>
    </View>
  );
}

// Cross-tenant Tier-2 disclosure flag: a solid colored chip + its tooltip/details.
function FlagChip({ flag }: { flag: { label: string; color: string; tooltip?: string | null } }) {
  return (
    <View style={{ alignSelf: 'stretch', marginTop: spacing.md }}>
      <View style={{ alignSelf: 'flex-start', backgroundColor: flag.color, borderRadius: radius.sm, paddingVertical: 5, paddingHorizontal: 12 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>⚑ {flag.label}</Text>
      </View>
      {flag.tooltip ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 4 }}>{flag.tooltip}</Text>
      ) : null}
    </View>
  );
}
