import { track } from '@/lib/analytics';
import { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { AppModal as Modal } from '@/ui/AppModal';
import { Alert } from '@/ui/dialog';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, control, nav, shadows } from '@/theme/index';
import { StudentInvitationModal } from '@/components/teacher/StudentInvitationModal';
import { formatNumber } from '@/utils/format';
import type { IconName } from '@/components/ui/Icon';
import { Icon } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/ErrorState';
import { isArabicName, isEgyptPhone } from '@/utils/validators';
import { getInvitationOptions, type InvitationCourseOption } from '@/api/invitation';
import { EnrollmentTermsSheet, useEnrollmentTerms } from '@/components/teacher/EnrollmentTermsSheet';
import { useTranslation } from 'react-i18next';
import { isQueued } from '@/api/offlineQueue';
import { recordStudent, orderCardsForNewlyAdded, type DedupeMatch, type RecordStudentPayload, type ParentRelationship, type ExistingStudentOffer } from '@/api/studentRecord';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Surface } from '@/ui/surfaces';

const label = () => ({ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs } as const);
const field = () => ({
  fontFamily: fonts.regular, fontSize: 17, minHeight: control.minHeight,
  backgroundColor: colors.surfaceSunken, borderRadius: radius.lg,
  paddingHorizontal: spacing.lg, paddingVertical: 14, color: colors.textPrimary,
  textAlign: 'right' as const, borderWidth: 1.5,
});

export default function RecordStudent() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // The home entry is hidden when the switch is off, but the route can still be reached
  // from history or a deep link — and the API would refuse anyway. Say so plainly rather
  // than letting someone fill the form and lose the typing.
  const { data: flags } = useFeatureFlags();
  const nameRef = useRef<TextInput>(null);

  const { data: options, isLoading, isError, refetch } = useQuery({
    queryKey: ['invitation-options'],
    queryFn: getInvitationOptions,
  });

  const [courseId, setCourseId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentName, setParentName] = useState('');
  const [relationship, setRelationship] = useState<ParentRelationship | null>(null);
  // The enrolment terms (position in the month, دفعة, booklet) — the one sheet every door
  // shows; seeded from the teacher's defaults for the chosen course.
  const terms = useEnrollmentTerms(courseId);
  const [saving, setSaving] = useState(false);
  const [count, setCount] = useState(0);
  const [enrollmentIds, setEnrollmentIds] = useState<number[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [dedupe, setDedupe] = useState<{ matches: DedupeMatch[]; payload: RecordStudentPayload } | null>(null);
  // QR-style popup: the entered student phone already exists in the system.
  const [ownStudent, setOwnStudent] = useState<ExistingStudentOffer | null>(null);
  const [orderingCards, setOrderingCards] = useState(false);
  // Names added in this batch, newest first (the page clears its fields after each one).
  const [added, setAdded] = useState<string[]>([]);

  const eligible = useMemo(() => (options?.courses ?? []).filter((c) => c.has_schedule), [options]);
  const course = useMemo(() => eligible.find((c) => c.id === courseId) ?? null, [eligible, courseId]);

  const nameError = name.trim() !== '' && !isArabicName(name);
  const phoneError = parentPhone.trim() !== '' && !isEgyptPhone(parentPhone);
  // The student's own phone — OPTIONAL for now (founder 2026-10-04): empty is fine, a typed
  // number must be valid. When given, the student signs in with it.
  const studentPhoneError = studentPhone.trim() !== '' && !isEgyptPhone(studentPhone);
  const sameAsParentError =
    studentPhone.trim() !== '' && parentPhone.trim() !== '' && studentPhone.trim() === parentPhone.trim();
  const canSubmit =
    courseId != null &&
    isArabicName(name.trim()) &&
    (studentPhone.trim() === '' || isEgyptPhone(studentPhone.trim())) &&
    isEgyptPhone(parentPhone.trim()) &&
    !sameAsParentError &&
    !terms.overpaid &&
    !saving;

  function afterCreated(enrollmentId: number | null, note?: string) {
    setCount((c) => c + 1);
    if (name.trim()) setAdded((list) => [name.trim(), ...list]);
    if (enrollmentId) setEnrollmentIds((ids) => [...ids, enrollmentId]);
    setName('');
    setStudentPhone('');
    setParentPhone('');
    setParentName('');
    setRelationship(null);
    // Keep the per-course answers (position, دفعة on/off, secures); drop the per-student money.
    terms.resetPerStudent();
    setFlash(note ?? t('enroll_ui.added_count', { count: count + 1 }));
    setTimeout(() => setFlash(null), note ? 3000 : 1800);
    nameRef.current?.focus();
  }

  async function submit(decision?: 'new' | 'link', linkStudentId?: number) {
    if (courseId == null) return;
    const payload: RecordStudentPayload = {
      student_name: name.trim(),
      ...(studentPhone.trim() ? { student_phone: studentPhone.trim() } : {}),
      parent_phone: parentPhone.trim(),
      ...(parentName.trim() ? { parent_name: parentName.trim() } : {}),
      ...(relationship ? { relationship } : {}),
      ...terms.payload(),
      course_id: courseId,
      ...(decision ? { dedupe_decision: decision } : {}),
      ...(linkStudentId ? { link_student_id: linkStudentId } : {}),
    };
    setSaving(true);
    try {
      const res = await recordStudent(payload);
      setDedupe(null);
      setOwnStudent(null);
      track('student_recorded', { via: 'fast', offline: isQueued(res), linked: !isQueued(res) && !!(res as { linked?: boolean }).linked });
      if (isQueued(res)) {
        // Parked on the phone: the server links or creates when the connection returns.
        afterCreated(null, t('offline.record_queued'));
        return;
      }
      afterCreated(res.enrollment_id);
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 409 && e.response.data?.code === 'EXISTING_STUDENT') {
        // The student phone already exists → show the QR-style profile popup;
        // "enroll here" re-posts as a link into the chosen course.
        setOwnStudent(e.response.data.errors?.offer ?? null);
      } else if (isAxiosError(e) && e.response?.status === 409 && e.response.data?.code === 'DEDUPE_REQUIRED') {
        setDedupe({ matches: e.response.data.errors?.matches ?? [], payload });
      } else if (isAxiosError(e) && e.response?.status === 422) {
        Alert.alert(t('enroll_ui.register_failed'), e.response.data?.message ?? t('enroll_ui.check_input'));
      } else {
        Alert.alert(t('enroll_ui.error_title'), t('enroll_ui.record_failed'));
      }
    } finally {
      setSaving(false);
    }
  }

  /**
   * A student who already has a card, or a parent's invitation QR, is not typed in: the scan
   * goes to the enrol screen with this group chosen (and a stranger there is «دعوة طالب»).
   */
  function scanInstead() {
    router.push({ pathname: '/(teacher)/enroll', params: courseId != null ? { course_id: String(courseId) } : {} });
  }

  /**
   * Card ordering is a SEPARATE, confirmed action — recording a student never orders a
   * card on its own. The confirmation names the count so a tap can't quietly file a
   * batch of print jobs.
   */
  function bulkOrderCards() {
    if (enrollmentIds.length === 0) return;
    Alert.alert(
      t('enroll_ui.order_cards_title'),
      t('enroll_ui.order_cards_body', { count: enrollmentIds.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('enroll_ui.order_cards_confirm'), onPress: submitCardOrders },
      ],
    );
  }

  async function submitCardOrders() {
    setOrderingCards(true);
    try {
      const r = await orderCardsForNewlyAdded(enrollmentIds);
      // The batch is filed, not printed: these families did not ask for a card, so the
      // super-admin releases the batch first. Say so, or the teacher promises cards
      // that may never be produced.
      const parts = [t('enroll_ui.cards_ordered', { count: r.created })];
      // A student may already be covered by another teacher's order — one card serves
      // every teacher, so we say it plainly without naming who ordered it.
      if (r.already_ordered) parts.push(t('enroll_ui.cards_already_covered', { count: r.already_ordered }));
      Alert.alert(t('common.done'), parts.join('\n'));
      setEnrollmentIds([]);
    } catch {
      Alert.alert(t('enroll_ui.error_title'), t('enroll_ui.order_cards_failed'));
    } finally {
      setOrderingCards(false);
    }
  }

  if (flags?.fast_register === false) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
        <Icon name="info" size={40} color={colors.textSecondary} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.md }}>
          {t('enroll_ui.fast_register_off_title')}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
          {t('enroll_ui.fast_register_off_body')}
        </Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85}
          style={{ marginTop: spacing.xl, minHeight: 48, alignSelf: 'stretch', borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.brand} /></View>;
  }
  if (isError && !options) {
    return <ErrorState onRetry={refetch} />;
  }

  const sectionCard = { backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm } as const;

  return (
    <Surface id="screen.teacher.record-student" screen>
    {/* iOS page sheet: it starts below the status bar, so the keyboard's overlap is measured from there. */}
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 10 : 0} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: nav.pageEnd + insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">
        {/* A sheet, not a page (founder 2026-10-22): a grabber, the title with this batch's count,
            a scan for a student who already has a card or an invitation, and a close. */}
        <Surface id="teacher.record_student.header">
        <View style={{ paddingTop: (Platform.OS === 'ios' ? spacing.sm : insets.top + spacing.sm), paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          {Platform.OS === 'ios' ? <View style={{ alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.md }} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}
              style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary }}>{t('enroll_ui.fast_register_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>{t('fast_register.subtitle')}</Text>
            </View>
            <Surface id="teacher.record_student.count_badge">
            <View style={{ minWidth: 38, height: 38, borderRadius: 12, paddingHorizontal: 8, backgroundColor: count ? colors.successLight : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={t('fast_register.added_now')}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: count ? colors.successText : colors.textTertiary }}>{formatNumber(count)}</Text>
            </View>
            </Surface>
            <TouchableOpacity onPress={scanInstead} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('fast_register.scan_hint')}
              style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="scan" size={19} color={colors.brand} />
            </TouchableOpacity>
          </View>
        </View>
        </Surface>

        <View style={{ paddingHorizontal: spacing.lg }}>
          {/* The group — chips; the chosen one's times under them. */}
          <Surface id="teacher.record_student.course_picker">
          <View style={sectionCard}>
            <StepHead n={1} icon="calendar" title={t('fast_register.step_group')} />
            {eligible.length === 0 ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary }}>{t('enroll_ui.no_scheduled_courses')}</Text>
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {eligible.map((c: InvitationCourseOption) => {
                    const on = c.id === courseId;
                    return (
                      <TouchableOpacity key={c.id} onPress={() => setCourseId(c.id)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: 1.5, borderColor: on ? colors.brand : colors.borderStrong, backgroundColor: on ? colors.brand : colors.surface }}>
                        {on ? <Icon name="success" size={14} color={colors.onPrimary} /> : null}
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: on ? colors.onPrimary : colors.textSecondary }}>{c.name}{c.grade_name ? ` · ${c.grade_name}` : ''}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {course?.schedule_label ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: spacing.sm }}>{course.schedule_label}</Text> : null}
              </>
            )}
          </View>
          </Surface>

          {courseId != null && (
            <>
              {/* 2 · The student */}
              <View style={sectionCard}>
                <StepHead n={2} icon="child" title={t('fast_register.step_student')} />
                <Surface id="teacher.record_student.student_name">
                <Text style={label()}>{t('invite_phone.student_name')}</Text>
                <TextInput
                  ref={nameRef}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('enroll_ui.full_name_ph')}
                  placeholderTextColor={colors.textTertiary}
                  style={{ ...field(), marginBottom: spacing.xs, borderColor: nameError ? colors.danger : (name ? colors.brand : colors.borderStrong) }}
                  returnKeyType="next"
                />
                {nameError ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.danger, marginBottom: spacing.md }}>{t('enroll_ui.name_arabic_error')}</Text> : <View style={{ height: spacing.md }} />}
                </Surface>

                {/* Student's own phone — their login handle when the app launches */}
                <Surface id="teacher.record_student.student_phone">
                <Text style={label()}>{t('invite_phone.student_phone')} <Text style={{ fontFamily: fonts.regular, color: colors.textTertiary }}>{t('enroll_ui.optional_paren')}</Text></Text>
                <TextInput
                  value={studentPhone}
                  onChangeText={setStudentPhone}
                  placeholder="01xxxxxxxxx"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                  style={{ ...field(), marginBottom: spacing.xs, borderColor: (studentPhoneError || sameAsParentError) ? colors.danger : (studentPhone ? colors.brand : colors.borderStrong) }}
                  returnKeyType="next"
                />
                {sameAsParentError
                  ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.danger }}>{t('enroll_ui.phone_same_as_parent')}</Text>
                  : studentPhoneError
                    ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.danger }}>{t('enroll_ui.phone_invalid')}</Text>
                    : <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary }}>{t('enroll_ui.student_phone_hint')}</Text>}
                </Surface>
              </View>

              {/* 3 · The parent — the activation anchor */}
              <View style={sectionCard}>
                <StepHead n={3} icon="phone" title={t('fast_register.step_parent')} />
                <Surface id="teacher.record_student.parent_phone">
                <Text style={label()}>{t('enroll_ui.parent_phone')}</Text>
                <TextInput
                  value={parentPhone}
                  onChangeText={setParentPhone}
                  placeholder="01xxxxxxxxx"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                  style={{ ...field(), marginBottom: spacing.xs, borderColor: phoneError ? colors.danger : (parentPhone ? colors.brand : colors.borderStrong) }}
                  onSubmitEditing={() => canSubmit && submit()}
                />
                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginBottom: spacing.lg }}>{t('enroll_ui.parent_phone_hint')}</Text>
                </Surface>

                {/* Parent name — OPTIONAL (the parent can set/modify it at setup). */}
                <Surface id="teacher.record_student.parent_name">
                <Text style={label()}>{t('enroll_ui.parent_name_optional')}</Text>
                <TextInput
                  value={parentName}
                  onChangeText={setParentName}
                  placeholder={t('enroll_ui.full_name_ph')}
                  placeholderTextColor={colors.textTertiary}
                  style={{ ...field(), marginBottom: spacing.lg, borderColor: parentName ? colors.brand : colors.borderStrong }}
                />
                </Surface>

                {/* Relationship — OPTIONAL, tap to toggle. */}
                <Surface id="teacher.record_student.relationship">
                <Text style={label()}>{t('enroll_ui.relationship_optional')}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {([['father', t('auth.father')], ['mother', t('auth.mother')], ['guardian', t('profile.role_parent')]] as const).map(([value, ar]) => {
                    const active = relationship === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        onPress={() => setRelationship(active ? null : value)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={{
                          flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.full, borderWidth: 1.5,
                          borderColor: active ? colors.brand : colors.borderStrong,
                          backgroundColor: active ? colors.brandTint : colors.surface,
                        }}
                      >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: active ? colors.brand : colors.textSecondary }}>{ar}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                </Surface>
              </View>

              {/* شروط التسجيل — the same sheet every door shows. */}
              <Surface id="teacher.record_student.terms_sheet"><EnrollmentTermsSheet terms={terms} /></Surface>

              {/* Save */}
              <Surface id="teacher.record_student.save_button">
              <TouchableOpacity onPress={() => submit()} disabled={!canSubmit} activeOpacity={0.85} accessibilityRole="button"
                style={{ marginTop: spacing.md, opacity: canSubmit ? 1 : 0.5, backgroundColor: colors.brand, borderRadius: radius.lg, minHeight: 56, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, ...shadows.sm }}>
                {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="add" size={20} color={colors.onPrimary} />}
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('enroll_ui.save_next')}</Text>
              </TouchableOpacity>
              </Surface>

              {flash ? (
                <Surface id="teacher.record_student.flash">
                <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.successLight, borderRadius: radius.lg, padding: spacing.md }}>
                  <Icon name="success" size={20} color={colors.successText} />
                  <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.successText }}>{flash}</Text>
                </View>
                </Surface>
              ) : null}

              {/* Who went in this batch, newest first — a glance, not a list to manage. */}
              {added.length > 0 ? (
                <Surface id="teacher.record_student.added_names">
                <View style={{ marginTop: spacing.lg }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('fast_register.added_title')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {added.slice(0, 12).map((n, i) => (
                      <View key={`${n}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Icon name="success" size={12} color={colors.success} />
                        <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textPrimary }}>{n}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                </Surface>
              ) : null}

              {/* Bulk card order for everyone added this session */}
              {enrollmentIds.length > 0 ? (
                <Surface id="teacher.record_student.order_cards">
                <TouchableOpacity onPress={bulkOrderCards} disabled={orderingCards} activeOpacity={0.85}
                  style={{ marginTop: spacing.lg, borderWidth: 1.5, borderColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
                  {orderingCards ? <ActivityIndicator color={colors.brand} /> : <Icon name="card" size={18} color={colors.brand} />}
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand }}>{t('enroll_ui.order_cards_for_added', { count: enrollmentIds.length })}</Text>
                </TouchableOpacity>
                </Surface>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {/* Dedupe modal — a student with this parent phone already exists */}
      <Surface id="teacher.record_student.dedupe_modal">
      <Modal visible={dedupe !== null} transparent animationType="fade" onRequestClose={() => setDedupe(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, marginBottom: spacing.sm }}>{t('enroll_ui.dedupe_title')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md }}>{t('enroll_ui.dedupe_body')}</Text>
            <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
              {(dedupe?.matches ?? []).map((m) => (
                <TouchableOpacity key={m.id} onPress={() => submit('link', m.id)} activeOpacity={0.85}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary }}>{m.name}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand, marginStart: spacing.sm }}>{t('enroll_ui.link_arrow')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Surface id="teacher.record_student.dedupe_modal.create_new">
            <TouchableOpacity onPress={() => submit('new')} activeOpacity={0.85} style={{ backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('enroll_ui.create_new_student')}</Text>
            </TouchableOpacity>
            </Surface>
            <TouchableOpacity onPress={() => setDedupe(null)} activeOpacity={0.7} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </Surface>

      {/* «دعوة طالب» — the phone belongs to a student already on دروس سبوت but not on this
          teacher's list: the same invitation the scanner shows, enrolling into this group. */}
      <Surface id="teacher.record_student.invitation_modal">
      <StudentInvitationModal
        student={ownStudent && !ownStudent.is_own && !ownStudent.already_in_target ? { name: ownStudent.name, grade: ownStudent.grade, via: 'card' } : null}
        course={ownStudent?.target_course_name ?? course?.name ?? null}
        busy={saving}
        onEnroll={() => ownStudent && submit('link', ownStudent.student_id)}
        onClose={() => setOwnStudent(null)}
      />
      </Surface>

      {/* QR-style popup — the entered phone is already one of THIS teacher's students.
          Same shape the scanner shows on a "wrong group" card: profile + enroll-here. */}
      <Surface id="teacher.record_student.existing_modal">
      <Modal visible={ownStudent !== null && (!!ownStudent.is_own || !!ownStudent.already_in_target)} transparent animationType="fade" onRequestClose={() => setOwnStudent(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center' }}>
            <Icon name="children" size={48} color={colors.brand} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.sm }}>{ownStudent?.name}</Text>
            {/* Profile chips — grade + code (own student, safe to show) */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
              {ownStudent?.grade ? (
                <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{ownStudent.grade}</Text>
                </View>
              ) : null}
              {ownStudent?.student_code ? (
                <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{ownStudent.student_code}</Text>
                </View>
              ) : null}
            </View>

            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.sm }}>
              {ownStudent?.already_in_target
                ? t('enroll_ui.own_already_in_target', { course: ownStudent?.target_course_name })
                : ownStudent?.is_own
                  ? t('enroll_ui.own_in_other_course', { current: ownStudent?.current_course_name ?? '—', course: ownStudent?.target_course_name })
                  : t('enroll_ui.own_in_system', { course: ownStudent?.target_course_name })}
            </Text>

            {saving ? (
              <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} />
            ) : ownStudent?.already_in_target ? (
              <TouchableOpacity onPress={() => setOwnStudent(null)} activeOpacity={0.85} style={{ marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('common.ok')}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Surface id="teacher.record_student.existing_modal.enroll_here">
                <TouchableOpacity onPress={() => ownStudent && submit('link', ownStudent.student_id)} activeOpacity={0.85} style={{ marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', alignSelf: 'stretch' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('enroll_ui.enroll_in_course', { course: ownStudent?.target_course_name })}</Text>
                </TouchableOpacity>
                </Surface>
                <TouchableOpacity onPress={() => setOwnStudent(null)} activeOpacity={0.7} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
      </Surface>
    </KeyboardAvoidingView>
    </Surface>
  );
}

/** A numbered section head: the order a teacher fills the form in. */
function StepHead({ n, icon, title }: { n: number; icon: IconName; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onPrimary }}>{formatNumber(n)}</Text>
      </View>
      <Icon name={icon} size={16} color={colors.textSecondary} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }}>{title}</Text>
    </View>
  );
}
