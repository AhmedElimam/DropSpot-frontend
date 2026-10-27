import { track } from '@/lib/analytics';
import { SheetModal } from '@/components/ui/SheetModal';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Vibration } from 'react-native';
import { Alert } from '@/ui/dialog';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useOfflineStore } from '@/stores/offlineStore';
import { router, useLocalSearchParams } from 'expo-router';
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
} from '@/api/students';
import {
  scanPreCard,
  confirmPreCard,
  cancelPreCard,
  enrollByScan,
  type PreCardScanStudent,
} from '@/api/preCardInvitation';
import { TeacherTip } from '@/components/TeacherTip';
import { Button } from '@/components/ui/Button';
import { EnrollmentTermsSheet, useEnrollmentTerms } from '@/components/teacher/EnrollmentTermsSheet';
import { Surface } from '@/ui/surfaces';

type Review =
  | { kind: 'match'; student: LookupStudent; value: string }
  | { kind: 'precard'; invitationId: number; student: PreCardScanStudent }
  /** No connection: the value is parked with the course and the terms, enrolled on replay. */
  | { kind: 'offline'; value: string }
  | { kind: 'miss' }
  | null;

export default function TeacherEnroll() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isAssistant } = useActiveAbilities();
  const [permission, requestPermission] = useCameraPermissions();
  const { data: classes, isLoading } = useQuery({ queryKey: ['enrollable-classes'], queryFn: getEnrollableClasses });

  // Enrollment is on the COURSE (schedule master) — pick the course, not a session.
  const [course, setCourse] = useState<EnrollableClass | null>(null);
  // Arriving from a «دعوة طالب» (the home scanner or fast register): the scanned value waits
  // for the group, then runs as if scanned here; fast register also names the group.
  const params = useLocalSearchParams<{ value?: string; course_id?: string }>();
  const pendingRef = useRef<string | null>(params.value ? String(params.value) : null);
  const [awaitingGroup, setAwaitingGroup] = useState(!!params.value);
  /**
   * «شروط التسجيل» for this course — the same sheet every door shows (position in the
   * month, دفعة, booklet). Founder 2026-10-02: it used to sit as a chip strip over the
   * camera plus an inline form inside the review card and looked cramped; now the camera
   * stays clean and the sheet opens as a popup right after a successful scan. Per-course
   * answers (position, دفعة on/off) carry from one student to the next; money resets.
   */
  const terms = useEnrollmentTerms(course?.course_id ?? null);
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
      // No connection (or one that is dropping): nothing to ask the server. Keep the value,
      // take the terms, and let the replay sort out pre-card token vs card.
      const net = useOfflineStore.getState();
      if (!net.online || net.weak) {
        Vibration.vibrate(50);
        setReview({ kind: 'offline', value: data });
        return;
      }
      setBusy(true);
      try {
        // 1. Is this a parent-generated pre-card invitation token? (structurally
        //    distinct from a card code — server reserves it and returns the student.)
        //    Teacher-only on the server: an assistant skips straight to the card lookup.
        //    Asking first used to answer every assistant scan with TEACHER_ONLY and stop,
        //    so an assistant granted manage_students could never enroll a card at all.
        if (!isAssistant) {
          try {
            const pre = await scanPreCard(data);
            Vibration.vibrate(50);
            setReview({ kind: 'precard', invitationId: pre.invitation_id, student: pre.student });
            return;
          } catch (e: any) {
            const code = e?.response?.data?.code;
            // A real pre-card conflict must surface, not be retried as a card.
            if (code === 'RESERVED_ELSEWHERE' || code === 'TEACHER_ONLY') {
              Alert.alert('', e?.response?.data?.message || t('enroll_ui.token_unusable'));
              return;
            }
            // INVALID_TOKEN / anything else → fall through to a normal card scan.
          }
        }

        // 2. Otherwise treat it as a physical card (QR/serial).
        const res = await lookupStudent('qr', data, course.course_id);
        Vibration.vibrate(50);
        setReview(res.found && res.student ? { kind: 'match', student: res.student, value: data } : { kind: 'miss' });
      } catch {
        Alert.alert('', t('enroll_ui.lookup_failed'));
      } finally {
        setBusy(false);
      }
    },
    [busy, review, done, course, isAssistant, t],
  );
  // The camera only while this screen is in front (invite-phone pushes over it and the stack does
  // not freeze), and ONE stable scan handler gated by a ref: toggling `onBarcodeScanned` makes
  // Android rebuild the whole camera on every card (founder 2026-10-09: «light on all devices»).
  const isFocused = useIsFocused();
  const scanPausedRef = useRef(false);
  const handleScanRef = useRef(handleScan);
  handleScanRef.current = handleScan;
  const onCameraScan = useCallback((e: Parameters<typeof handleScan>[0]) => {
    if (scanPausedRef.current) return;
    void handleScanRef.current(e);
  }, []);

  useEffect(() => {
    if (course || !params.course_id || !classes) return;
    const c = classes.find((x) => String(x.course_id) === String(params.course_id));
    if (c) setCourse(c);
  }, [classes, course, params.course_id]);
  useEffect(() => {
    if (!course || !pendingRef.current) return;
    const value = pendingRef.current;
    pendingRef.current = null;
    setAwaitingGroup(false);
    void handleScanRef.current({ data: value });
  }, [course]);

  const enroll = useMutation({
    mutationFn: (vars: { value: string; acceptGradeMismatch?: boolean }) =>
      enrollByCard({
        method: 'qr',
        value: vars.value,
        course_id: course!.course_id,
        academic_session_id: course!.academic_session_id,
        accept_grade_mismatch: vars.acceptGradeMismatch,
        ...terms.payload(),
      }),
  });

  // Pre-card: confirm the reserved token → enrollment (spec §5). Consumption
  // happens server-side only on this commit.
  const confirmPre = useMutation({
    mutationFn: (invitationId: number) =>
      confirmPreCard(invitationId, {
        course_id: course!.course_id,
        academic_session_id: course!.academic_session_id,
        ...terms.payload(),
      }),
  });

  const enrollLater = useMutation({
    mutationFn: (value: string) =>
      enrollByScan({
        value,
        course_id: course!.course_id,
        academic_session_id: course!.academic_session_id,
        ...terms.payload(),
      }),
  });

  const flashDone = (name: string, via?: 'card' | 'pre_card' | 'offline') => {
    if (via) track('student_enrolled', { via });
    setReview(null);
    terms.resetPerStudent();
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
          onSuccess: () => flashDone(name, 'card'),
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
            Alert.alert('', e?.response?.data?.message || t('enroll_ui.register_failed'));
          },
        });
      run();
    } else if (review.kind === 'precard') {
      const name = review.student.name;
      confirmPre.mutate(review.invitationId, {
        onSuccess: () => flashDone(name, 'pre_card'),
        onError: (e: any) => Alert.alert('', e?.response?.data?.message || t('enroll_ui.register_failed')),
      });
    } else if (review.kind === 'offline') {
      enrollLater.mutate(review.value, {
        onSuccess: () => flashDone(t('offline.qr_saved_done'), 'offline'),
        onError: (e: any) => Alert.alert('', e?.response?.data?.message || t('offline.qr_save_failed')),
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
      <Surface id="screen.teacher.enroll" screen>
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
        <Icon name="scan" size={56} color={colors.brand} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg }}>{t('teacher.camera_permission_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
          {t('enroll_ui.camera_permission_body')}
        </Text>
        <TouchableOpacity onPress={requestPermission} activeOpacity={0.85} style={{ marginTop: spacing.xl, backgroundColor: colors.brand, borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.xxl }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }}>{t('teacher.grant_camera')}</Text>
        </TouchableOpacity>
      </View>
      </Surface>
    );
  }

  // ---- Step 1: pick the course (schedule master) ----
  if (!ready) {
    return (
      <Surface id="screen.teacher.enroll" screen>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <Surface id="teacher.enroll.tip">
        <TeacherTip
          tip="invitation"
          icon="add"
          titleKey="onboarding.tip_invitation_title"
          bodyKey="onboarding.tip_invitation_body"
          bulletKeys={['onboarding.tip_invitation_b1', 'onboarding.tip_invitation_b2']}
        />
        </Surface>
        <View style={{ padding: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="forward" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary }}>{t('offline.actions.record_student')}</Text>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, marginTop: spacing.md }}>
            {t('enroll_ui.enroll_intro')}
          </Text>
          {awaitingGroup ? (
            <Surface id="teacher.enroll.invitation_waiting">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, backgroundColor: colors.brandTint, borderRadius: radius.lg, padding: spacing.md }}>
              <Icon name="add" size={18} color={colors.brand} />
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 20, color: colors.brand }}>{t('invitation_modal.pick_group')}</Text>
            </View>
            </Surface>
          ) : null}
        </View>
        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
        ) : (
          <Surface id="teacher.enroll.course_picker">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm }}>
            {(classes ?? []).length === 0 ? (
              <Text style={{ fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>
                {t('enroll_ui.no_scheduled_courses')}
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
                      {c.slots.length} {c.slots.length === 1 ? t('enroll_ui.weekly_slot_one') : t('enroll_ui.weekly_slot_many')}
                    </Text>
                  </View>
                  <Icon name="back" size={18} color={colors.brand} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          </Surface>
        )}
      </View>
      </Surface>
    );
  }

  // ---- Step 2: scan + review ----
  scanPausedRef.current = !!(busy || review || done);
  return (
    <Surface id="screen.teacher.enroll" screen>
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {isFocused ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          // QR first + a short list → reliable QR detection; Code128 keeps physical
          // cards scannable (both symbologies encode the same credential).
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128'] }}
          onBarcodeScanned={onCameraScan}
        />
      ) : <View style={{ flex: 1 }} />}

      {/* Top bar: chosen course + change */}
      <Surface id="teacher.enroll.header">
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: 'rgba(23,28,59,0.72)', flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <TouchableOpacity onPress={() => { setCourse(null); setReview(null); }} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{t('enroll_ui.enrolling_in_course')}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }} numberOfLines={1}>{course!.course_name}</Text>
        </View>
      </View>
      </Surface>

      {/* Scan frame */}
      {!review && !done ? (
        <Surface id="teacher.enroll.frame">
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
          <View style={{ width: 240, height: 240, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 24 }} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: '#fff', marginTop: spacing.lg }}>
            {busy ? t('enroll_ui.searching') : t('enroll_ui.aim_camera')}
          </Text>
          {busy ? <ActivityIndicator color="#fff" style={{ marginTop: spacing.md }} /> : null}
        </View>
        </Surface>
      ) : null}

      {/* Invite by phone — opens the SAME full invite-by-phone form as the manage hub
          (name + student & parent phones + down-payment + dedupe, all validated). One
          consistent phone-invite path, with the scanned course pre-selected. */}
      {!review && !done ? (
        <Surface id="teacher.enroll.invite_by_phone">
        <TouchableOpacity
          onPress={() => course && router.push({ pathname: '/(teacher)/invite-phone', params: { courseId: String(course.course_id) } })}
          activeOpacity={0.85}
          style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: insets.bottom + spacing.xl, minHeight: 52, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm }}
        >
          <Icon name="phone" size={18} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('invites.by_phone')}</Text>
        </TouchableOpacity>
        </Surface>
      ) : null}

      {/* No student behind this card — a small bottom card, back to scanning. */}
      {review?.kind === 'miss' ? (
        <Surface id="teacher.enroll.miss_card">
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('enroll_ui.no_student_for_card')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs }}>{t('enroll_ui.check_card_rescan')}</Text>
          <Button title={t('enroll_ui.rescan')} onPress={() => setReview(null)} style={{ marginTop: spacing.lg }} />
        </View>
        </Surface>
      ) : null}

      {/* The popup after a successful scan: who was scanned, then «شروط التسجيل», then
          accept / reject. The camera underneath is ignored while it is open. */}
      {review && review.kind !== 'miss' ? (
        <Surface id="teacher.enroll.review_sheet">
        <SheetModal visible onClose={dismiss} avoidKeyboard style={{ backgroundColor: colors.background, maxHeight: '92%', overflow: 'hidden' }}>
              {/* Header: the student. */}
              <View style={{ backgroundColor: colors.surface, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    {review.kind === 'precard' ? (
                      <View style={{ alignSelf: 'flex-start', marginBottom: spacing.sm }}>
                        <Badge text={t('enroll_ui.precard_badge')} color={colors.brand} />
                      </View>
                    ) : review.kind === 'offline' ? (
                      <View style={{ alignSelf: 'flex-start', marginBottom: spacing.sm }}>
                        <Badge text={t('offline.qr_saved_badge')} color={colors.warningDark} />
                      </View>
                    ) : null}
                    <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary }}>{review.kind === 'offline' ? t('offline.qr_saved_title') : review.student.name}</Text>
                    {review.kind === 'offline' ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary, marginTop: 4 }}>{t('offline.qr_saved_hint', { course: course?.course_name ?? '' })}</Text>
                    ) : null}
                    {review.kind === 'precard' && review.student.grade ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>{review.student.grade}</Text>
                    ) : null}
                    {review.kind === 'match' ? (
                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
                        <Badge text={review.student.has_card ? t('enroll_ui.has_card') : t('teacher.card_less')} color={review.student.has_card ? colors.success : colors.textSecondary} />
                      </View>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={dismiss} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
                    <Icon name="close" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                {/* Cross-tenant disclosure: a confirmed report's colored flag (label +
                    color); legacy confirmed-without-flag falls back to the fixed notice. */}
                <Surface id="teacher.enroll.review_sheet.flag">
                {review.kind !== 'offline' && review.student.report_flag ? <FlagChip flag={review.student.report_flag} /> : null}
                {review.kind !== 'offline' && review.student.report_notice && review.student.report_notice_message ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: review.kind === 'precard' ? colors.warning : colors.danger, marginTop: spacing.md }}>
                    {review.student.report_notice_message}
                  </Text>
                ) : null}
                </Surface>
              </View>

              {/* Body: the shared terms sheet (position in the month, دفعة, booklet). */}
              <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.sm }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Surface id="teacher.enroll.review_sheet.terms">
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.sm }}>{t('enroll_ui.terms_title')}</Text>
                <EnrollmentTermsSheet terms={terms} />
                </Surface>
              </ScrollView>

              {/* Footer: reject / accept. */}
              <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border }}>
                <Surface id="teacher.enroll.review_sheet.reject"><Button title={t('invites.reject')} variant="outline" onPress={dismiss} style={{ flex: 1 }} /></Surface>
                <Surface id="teacher.enroll.review_sheet.accept">
                <Button
                  title={t('enroll_ui.accept_enroll')}
                  variant="success"
                  onPress={accept}
                  loading={enroll.isPending || confirmPre.isPending || enrollLater.isPending}
                  disabled={terms.overpaid || terms.isLoading}
                  style={{ flex: 2 }}
                />
                </Surface>
              </View>
        </SheetModal>
        </Surface>
      ) : null}

      {/* Success flash */}
      {done ? (
        <Surface id="teacher.enroll.success_flash">
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(31,147,102,0.96)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }} pointerEvents="none">
          <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="success" size={64} color="#fff" />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff', textAlign: 'center', marginTop: spacing.lg }}>{done}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 18, color: '#fff', marginTop: spacing.sm }}>{t('enroll_ui.enrolled_in_course')}</Text>
        </View>
        </Surface>
      ) : null}
    </View>
    </Surface>
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
