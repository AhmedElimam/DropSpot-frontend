import { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Vibration } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
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
} from '@/api/students';
import {
  scanPreCard,
  confirmPreCard,
  cancelPreCard,
  type PreCardScanStudent,
} from '@/api/preCardInvitation';

type Review =
  | { kind: 'match'; student: LookupStudent; value: string }
  | { kind: 'precard'; invitationId: number; student: PreCardScanStudent }
  | { kind: 'miss' }
  | null;

export default function TeacherEnroll() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { data: classes, isLoading } = useQuery({ queryKey: ['enrollable-classes'], queryFn: getEnrollableClasses });

  // Enrollment is on the COURSE (schedule master) — pick the course, not a session.
  const [course, setCourse] = useState<EnrollableClass | null>(null);
  const [review, setReview] = useState<Review>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

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
    mutationFn: (value: string) =>
      enrollByCard({
        method: 'qr',
        value,
        course_id: course!.course_id,
        academic_session_id: course!.academic_session_id,
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
      enroll.mutate(review.value, {
        onSuccess: () => flashDone(name),
        onError: (e: any) => Alert.alert('', e?.response?.data?.message || 'تعذّر التسجيل'),
      });
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
        <View style={{ padding: spacing.xl }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary }}>تسجيل طالب</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, marginTop: spacing.xs }}>
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
                  <Icon name="forward" size={18} color={colors.brand} />
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
        onBarcodeScanned={busy || review || done ? undefined : handleScan}
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
      {!review && !done ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
          <View style={{ width: 240, height: 240, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 24 }} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: '#fff', marginTop: spacing.lg }}>
            {busy ? 'جارٍ البحث…' : 'وجّه الكاميرا نحو رمز QR على البطاقة'}
          </Text>
          {busy ? <ActivityIndicator color="#fff" style={{ marginTop: spacing.md }} /> : null}
        </View>
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
              {/* Cross-tenant disclosure is a single fixed notice now — never a
                  severity tier/score (Tiered Disclosure §3, §6). */}
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
