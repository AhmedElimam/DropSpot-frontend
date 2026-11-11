import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Alert } from '@/ui/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, control, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHero } from '@/components/ui/PageHero';
import { SheetModal } from '@/components/ui/SheetModal';
import { isArabicName, isEgyptPhone } from '@/utils/validators';
import {
  getInvitationOptions, createInvitation,
  type CreateInvitationPayload, type DedupeMatch, type InvitationCourseOption,
} from '@/api/invitation';
import { EnrollmentTermsSheet, useEnrollmentTerms } from '@/components/teacher/EnrollmentTermsSheet';
import { CoursePickCard, sectionCardStyle } from '@/components/teacher/CoursePickCard';
import { StepHead } from '@/components/teacher/StepHead';
import { Surface } from '@/ui/surfaces';

const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 11);

/**
 * Phone invitation, in fast register's shape (founder 2026-11-07: «UI not like the fast
 * register»): the groups first; tapping one opens a sheet — the student, the parent, «شروط
 * التسجيل» — and sends the SMS. It stays open for the next student. «نفس الطالب؟» is asked
 * inside the sheet (a second popup over a sheet is held by iOS until the sheet closes).
 */
export default function InvitePhone() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const { data: options, isLoading, isError, refetch } = useQuery({
    queryKey: ['invitation-options'],
    queryFn: getInvitationOptions,
  });

  const [courseId, setCourseId] = useState<number | null>(null);
  const [termId, setTermId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  // The enrolment terms (position in the month, دفعة, booklet) — the one sheet every door
  // shows; seeded from the teacher's defaults for the chosen course.
  const terms = useEnrollmentTerms(courseId);
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<DedupeMatch[] | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [sentByCourse, setSentByCourse] = useState<Record<number, number>>({});

  const eligible = useMemo(() => (options?.courses ?? []).filter((c) => c.has_schedule), [options]);
  const course = useMemo(() => eligible.find((c) => c.id === courseId) ?? null, [eligible, courseId]);

  const selectCourse = (c: InvitationCourseOption) => {
    if (c.id !== courseId) { setMatches(null); }
    setCourseId(c.id);
    setTermId(c.academic_session_id ?? termId ?? options?.terms.find((x) => x.is_current)?.id ?? null);
    setOpen(true);
  };

  // Opened from the scanner («دعوة برقم الهاتف»): straight into that group's sheet.
  const params = useLocalSearchParams<{ courseId?: string }>();
  useEffect(() => {
    if (!options || courseId != null || !params.courseId) return;
    const c = eligible.find((x) => x.id === Number(params.courseId));
    if (c) selectCourse(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, params.courseId]);

  // Inline validation mirroring the server rules — a provided name must be Arabic and a
  // provided phone must be a full Egyptian mobile (01xxxxxxxxx).
  const nameError = name.trim() !== '' && !isArabicName(name);
  const studentPhoneError = studentPhone.trim() !== '' && !isEgyptPhone(studentPhone);
  const parentPhoneError = parentPhone.trim() !== '' && !isEgyptPhone(parentPhone);
  const hasValidPhone = (studentPhone.trim() !== '' && isEgyptPhone(studentPhone))
    || (parentPhone.trim() !== '' && isEgyptPhone(parentPhone));
  const canSubmit = courseId != null && termId != null && hasValidPhone
    && !nameError && !studentPhoneError && !parentPhoneError && !terms.overpaid && !busy;

  const buildPayload = (extra?: Partial<CreateInvitationPayload>): CreateInvitationPayload => ({
    course_id: courseId!,
    academic_session_id: termId!,
    grade_id: course?.grade_id ?? null,
    invited_student_name: name.trim() || undefined,
    student_phone: studentPhone.trim() || undefined,
    parent_phone: parentPhone.trim() || undefined,
    ...terms.payload(),
    ...extra,
  });

  /** Sent (or linked): a short note, the fields cleared for the next student, the sheet kept. */
  const next = (note: string) => {
    const who = name.trim();
    setMatches(null);
    setName('');
    setStudentPhone('');
    setParentPhone('');
    terms.resetPerStudent();
    if (courseId != null) setSentByCourse((m) => ({ ...m, [courseId]: (m[courseId] ?? 0) + 1 }));
    setFlash(who ? `${note} — ${who}` : note);
    setTimeout(() => setFlash(null), 4000);
  };

  const send = async (extra?: Partial<CreateInvitationPayload>) => {
    if (courseId == null || termId == null) return;
    setBusy(true);
    try {
      const res = await createInvitation(buildPayload(extra));
      if (res.kind === 'dedupe') { setMatches(res.matches); return; }
      if (res.kind === 'grade_mismatch') {
        // Linking an existing student whose saved grade differs from the course — ask, then
        // resend accepting the mismatch (keeping the same link decision).
        Alert.alert(t('enroll.grade_mismatch_title'), res.message, [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('enroll.enroll_anyway'), onPress: () => { void send({ ...extra, accept_grade_mismatch: true }); } },
        ]);
        return;
      }
      if (res.kind === 'linked') { next(t('invite_phone.linked')); return; }
      if (res.smsSent) { next(t('invite_phone.sent')); return; }
      // Created, but the SMS provider did NOT take it — say so (parity with the web) rather than
      // a false «sent». The invitation exists; the number can be fixed and sent again.
      Alert.alert(t('invite_phone.sms_failed_title'), res.smsWarning || t('invite_phone.sms_failed_body'));
    } catch {
      Alert.alert(t('common.error'), t('invite_phone.failed'));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={colors.brand} /></View>;
  }
  if (isError && !options) {
    return <View style={{ flex: 1, backgroundColor: colors.background }}><ErrorState onRetry={() => refetch()} /></View>;
  }

  const card = sectionCardStyle();
  const label = { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs } as const;
  const field = (bad: boolean, filled: boolean) => ({
    fontFamily: fonts.regular, fontSize: 17, minHeight: control.minHeight, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: 14, color: colors.textPrimary, borderWidth: 1.5,
    borderColor: bad ? colors.danger : filled ? colors.brand : colors.borderStrong,
  });
  const err = { fontFamily: fonts.regular, fontSize: 12.5, color: colors.danger, marginTop: spacing.xs } as const;
  const terms2 = options?.terms ?? [];

  return (
    <Surface id="screen.teacher.invite-phone" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: nav.pageEnd + insets.bottom + spacing.xxl }}>
        <Surface id="teacher.invite_phone.header">
          <PageHero title={t('invite_phone.title')} subtitle={t('invite_phone.subtitle')} onBack />
        </Surface>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4 }}>
          <Surface id="teacher.invite_phone.course_picker">
            <CoursePickCard courses={eligible} onPick={selectCourse} hint={t('invite_phone.pick_hint')} actionIcon="phone"
              counts={sentByCourse} emptyText={t('invite_phone.no_courses')} />
          </Surface>
        </View>
      </ScrollView>

      <Surface id="teacher.invite_phone.form_sheet">
      <SheetModal visible={open && course != null} onClose={() => setOpen(false)} avoidKeyboard style={{ backgroundColor: colors.background, maxHeight: '92%', padding: 0 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
          {/* The group, and close. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }} numberOfLines={1}>{course?.name}{course?.grade_name ? ` · ${course.grade_name}` : ''}</Text>
              {course?.schedule_label ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>{course.schedule_label}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}
              style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* The term — only when there is a choice. */}
          {terms2.length > 1 ? (
            <Surface id="teacher.invite_phone.term_picker">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
              {terms2.map((tm) => {
                const on = termId === tm.id;
                return (
                  <TouchableOpacity key={tm.id} onPress={() => setTermId(tm.id)} activeOpacity={0.8}
                    style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surface }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.brand : colors.textSecondary }}>{tm.name}{tm.is_current ? ' ●' : ''}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            </Surface>
          ) : null}

          {/* 1 — the student. */}
          <Surface id="teacher.invite_phone.student_card">
          <View style={card}>
            <StepHead n={1} icon="child" title={t('fast_register.step_student')} />
            <Text style={label}>{t('invite_phone.student_name')} <Text style={{ fontFamily: fonts.regular, color: colors.textTertiary }}>{t('enroll_ui.optional_paren')}</Text></Text>
            <TextInput value={name} onChangeText={setName} placeholder={t('invite_phone.name_ph')} placeholderTextColor={colors.textTertiary} maxLength={120}
              style={{ ...field(nameError, !!name), textAlign: 'right' }} returnKeyType="next" />
            {nameError ? <Text style={err}>{t('invite_phone.name_arabic_error')}</Text> : null}
            <Text style={{ ...label, marginTop: spacing.md }}>{t('invite_phone.student_phone')}</Text>
            <TextInput value={studentPhone} onChangeText={(v) => setStudentPhone(digits(v))} keyboardType="phone-pad" placeholder="01xxxxxxxxx" placeholderTextColor={colors.textTertiary}
              maxLength={11} style={{ ...field(studentPhoneError, !!studentPhone), textAlign: 'right' }} />
            {studentPhoneError ? <Text style={err}>{t('invite_phone.phone_format_error')}</Text> : null}
          </View>
          </Surface>

          {/* 2 — the parent. */}
          <Surface id="teacher.invite_phone.parent_card">
          <View style={card}>
            <StepHead n={2} icon="phone" title={t('fast_register.step_parent')} />
            <Text style={label}>{t('invite_phone.parent_phone')}</Text>
            <TextInput value={parentPhone} onChangeText={(v) => setParentPhone(digits(v))} keyboardType="phone-pad" placeholder="01xxxxxxxxx" placeholderTextColor={colors.textTertiary}
              maxLength={11} style={{ ...field(parentPhoneError, !!parentPhone), textAlign: 'right' }} />
            {parentPhoneError ? <Text style={err}>{t('invite_phone.phone_format_error')}</Text> : null}
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginTop: spacing.sm }}>{t('invite_phone.phone_hint')}</Text>
          </View>
          </Surface>

          {/* 3 — شروط التسجيل, the same sheet every door shows. */}
          <Surface id="teacher.invite_phone.terms_sheet">
          <View style={card}>
            <StepHead n={3} icon="money" title={t('enroll_ui.terms_title')} />
            <EnrollmentTermsSheet terms={terms} />
          </View>
          </Surface>

          {/* Sent: right above the button the teacher just pressed (the sheet scrolls itself). */}
          {flash ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.successLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
              <Icon name="success" size={18} color={colors.successText} />
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.successText }}>{flash}</Text>
            </View>
          ) : null}
          {/* «نفس الطالب؟» — asked right here, not in a popup over the sheet. */}
          {matches ? (
            <Surface id="teacher.invite_phone.dedupe_modal">
            <View style={{ ...card, borderColor: colors.warning, borderWidth: 1.5 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }}>{t('invite_phone.dedupe_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md }}>{t('invite_phone.dedupe_body')}</Text>
              {matches.map((m) => (
                <TouchableOpacity key={m.id} onPress={() => send({ dedupe_decision: 'link', link_student_id: m.id })} disabled={busy} activeOpacity={0.85}
                  style={{ borderWidth: 1.5, borderColor: colors.brand, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.brand }}>{t('invite_phone.same_student')}: {m.name ?? `#${m.id}`}</Text>
                </TouchableOpacity>
              ))}
              <Surface id="teacher.invite_phone.dedupe_modal.new_student">
              <TouchableOpacity onPress={() => send({ dedupe_decision: 'new' })} disabled={busy} activeOpacity={0.85}
                style={{ backgroundColor: colors.brand, borderRadius: radius.lg, padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.onPrimary, textAlign: 'center' }}>{t('invite_phone.new_student')}</Text>
              </TouchableOpacity>
              </Surface>
              <TouchableOpacity onPress={() => setMatches(null)} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
            </Surface>
          ) : (
            <Surface id="teacher.invite_phone.send_button">
            <TouchableOpacity onPress={() => send()} disabled={!canSubmit} activeOpacity={0.85} accessibilityRole="button"
              style={{ minHeight: 54, borderRadius: radius.lg, backgroundColor: canSubmit ? colors.brand : colors.border, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', alignItems: 'center' }}>
              {busy ? <ActivityIndicator color={colors.onPrimary} /> : (
                <>
                  <Icon name="send" size={18} color={colors.onPrimary} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('invite_phone.send')}</Text>
                </>
              )}
            </TouchableOpacity>
            </Surface>
          )}
        </ScrollView>
      </SheetModal>
      </Surface>
    </View>
    </Surface>
  );
}
