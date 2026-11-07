import { track } from '@/lib/analytics';
import { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { PageHero } from '@/components/ui/PageHero';
import { AppModal as Modal } from '@/ui/AppModal';
import { Alert } from '@/ui/dialog';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, control, nav, shadows } from '@/theme/index';
import { StudentInvitationModal } from '@/components/teacher/StudentInvitationModal';
import { CoursePickCard } from '@/components/teacher/CoursePickCard';
import { StepHead } from '@/components/teacher/StepHead';
import type { IconName } from '@/components/ui/Icon';
import { Icon } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/ErrorState';
import { isDoorName, cleanDoorName, normalizeEgyptPhone } from '@/utils/validators';
import { addParentNumber } from '@/api/phoneConfirmations';
import { getInvitationOptions } from '@/api/invitation';
import { EnrollmentTermsSheet, useEnrollmentTerms } from '@/components/teacher/EnrollmentTermsSheet';
import { useTranslation } from 'react-i18next';
import { isQueued } from '@/api/offlineQueue';
import { recordStudent, lookupRecordPhone, type DedupeMatch, type RecordStudentPayload, type ParentRelationship, type ExistingStudentOffer, type RecordLookup, type LookupChild } from '@/api/studentRecord';
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
  const [flash, setFlash] = useState<string | null>(null);
  const [dedupe, setDedupe] = useState<{ matches: DedupeMatch[]; payload: RecordStudentPayload } | null>(null);
  // QR-style popup: the entered student phone already exists in the system.
  const [ownStudent, setOwnStudent] = useState<ExistingStudentOffer | null>(null);
  // Names added in this batch, newest first (the page clears its fields after each one).
  const [added, setAdded] = useState<string[]>([]);
  const [addedByCourse, setAddedByCourse] = useState<Record<number, number>>({});
  // The inputs open in a modal once a group is tapped (founder 2026-10-22).
  const [formOpen, setFormOpen] = useState(false);
  // Fast register v2 (founder 2026-11-06): one box first — «do we already know this number?» —
  // and the form only for a student nobody knows. 'lookup' → 'found' (a card / the children) or 'form'.
  const [step, setStep] = useState<'lookup' | 'found' | 'form'>('lookup');
  const [box, setBox] = useState('');
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState<RecordLookup | null>(null);
  const [boxNote, setBoxNote] = useState<string | null>(null);
  // The children already on the parent's number, when «طالب جديد» was chosen from them («بنفس الاسم؟»).
  const [siblings, setSiblings] = useState<LookupChild[]>([]);
  // One weekly time of the course, or null = the whole course (the default; founder's choice).
  const [addParentPhone, setAddParentPhone] = useState('');
  const [addingParent, setAddingParent] = useState(false);
  const openForm = (id: number) => {
    setCourseId(id);
    backToBox();
    setFormOpen(true);
  };
  function backToBox() {
    setStep('lookup');
    setBox('');
    setFound(null);
    setBoxNote(null);
    setSiblings([]);
    setAddParentPhone('');
  }

  // Every course, with or without weekly times (v2): one without them enrols at course level
  // and says «أضف المواعيد».
  const eligible = useMemo(() => options?.courses ?? [], [options]);
  const course = useMemo(() => eligible.find((c) => c.id === courseId) ?? null, [eligible, courseId]);

  // Names lose تشكيل and may carry a hyphen; phones accept Arabic digits, spaces, dashes and
  // +20 — both exactly as the server cleans them (v2), shown as they will be saved.
  const nameError = name.trim() !== '' && !isDoorName(name);
  const parentNorm = normalizeEgyptPhone(parentPhone);
  const studentNorm = normalizeEgyptPhone(studentPhone);
  const phoneError = parentPhone.trim() !== '' && parentNorm === null;
  // The student's own phone — optional (founder 2026-10-04) when the parent's is given; a typed
  // number must be valid. When given, the student signs in with it.
  const studentPhoneError = studentPhone.trim() !== '' && studentNorm === null;
  // The parent's number — optional since 2026-11-03 (founder): without it the server texts the
  // student a link to add it, proved by a code sent to the parent. One of the two is required.
  const noPhone = studentPhone.trim() === '' && parentPhone.trim() === '';
  const sameAsParentError = studentNorm !== null && studentNorm === parentNorm;
  const canSubmit =
    courseId != null &&
    isDoorName(name) &&
    !studentPhoneError &&
    !phoneError &&
    !noPhone &&
    !sameAsParentError &&
    !terms.overpaid &&
    !saving;

  function afterCreated(_enrollmentId: number | null, note?: string, who?: string) {
    setCount((c) => c + 1);
    const shown = who ?? cleanDoorName(name);
    if (shown) setAdded((list) => [shown, ...list]);
    if (courseId != null) setAddedByCourse((m) => ({ ...m, [courseId]: (m[courseId] ?? 0) + 1 }));
    setName('');
    setStudentPhone('');
    setParentPhone('');
    setParentName('');
    setRelationship(null);
    // Keep the per-course answers (position, دفعة on/off, secures); drop the per-student money.
    terms.resetPerStudent();
    setFlash(note ?? t('enroll_ui.added_count', { count: count + 1 }));
    setTimeout(() => setFlash(null), note ? 3000 : 1800);
    // The next student starts at the box again (the time chosen for the course stays).
    backToBox();
  }

  type SubmitOpts = {
    withoutStudentPhone?: boolean; acceptGrade?: boolean; parentPhone?: string; allowSameName?: boolean;
    /** A link straight from the lookup's card: the number it was found by, and nothing typed. */
    via?: { student_phone?: string; parent_phone?: string; name: string };
  };
  async function submit(decision?: 'new' | 'link', linkStudentId?: number, opts: SubmitOpts = {}) {
    if (courseId == null) return;
    // «سجّله بدون رقم هاتف»: the typed number is a sibling's own login, so this child is
    // recorded on the parent's number alone.
    if (opts.withoutStudentPhone) setStudentPhone('');
    const ownPhone = opts.via ? (opts.via.student_phone ?? '') : opts.withoutStudentPhone ? '' : (studentNorm ?? studentPhone.trim());
    const parent = opts.via ? (opts.via.parent_phone ?? '') : (normalizeEgyptPhone(opts.parentPhone ?? parentPhone) ?? (opts.parentPhone ?? parentPhone).trim());
    const payload: RecordStudentPayload = {
      ...(opts.via ? {} : { student_name: cleanDoorName(name) }),
      ...(ownPhone ? { student_phone: ownPhone } : {}),
      ...(parent ? { parent_phone: parent } : {}),
      ...(parentName.trim() ? { parent_name: parentName.trim() } : {}),
      ...(relationship ? { relationship } : {}),
      ...terms.payload(),
      course_id: courseId,
      ...(decision ? { dedupe_decision: decision } : {}),
      ...(linkStudentId ? { link_student_id: linkStudentId } : {}),
      ...(opts.acceptGrade ? { accept_grade_mismatch: true } : {}),
      ...(opts.allowSameName ? { allow_same_name: true } : {}),
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
      afterCreated(res.enrollment_id, res.parent_invited ? t('enroll_ui.parent_invited_note') : undefined, opts.via?.name);
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 409 && e.response.data?.code === 'EXISTING_STUDENT') {
        // The student phone already exists → show the QR-style profile popup;
        // "enroll here" re-posts as a link into the chosen course.
        setOwnStudent(e.response.data.errors?.offer ?? null);
      } else if (isAxiosError(e) && e.response?.status === 409 && e.response.data?.code === 'DEDUPE_REQUIRED') {
        setDedupe({ matches: e.response.data.errors?.matches ?? [], payload });
      } else if (isAxiosError(e) && e.response?.status === 422 && e.response.data?.code === 'GRADE_MISMATCH') {
        // The server asks a question here — answer it with a real button, not «حسنًا».
        Alert.alert(t('enroll_ui.grade_mismatch_title'), e.response.data?.message ?? '', [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('enroll_ui.grade_mismatch_confirm'), onPress: () => { void submit(decision, linkStudentId, { ...opts, acceptGrade: true }); } },
        ]);
      } else if (isAxiosError(e) && e.response?.status === 422 && e.response.data?.code === 'PARENT_PHONE_IS_STUDENT') {
        // The «parent» number is a brother's own login: offer his parent's number and record
        // this child as his sibling (the server still links a repeat of the same child).
        const sib = e.response.data.errors?.sibling as { name: string | null; parent_phone: string | null } | undefined;
        const siblingParent = sib?.parent_phone;
        Alert.alert(t('enroll_ui.register_failed'), e.response.data?.message ?? '', siblingParent
          ? [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('enroll_ui.use_sibling_parent', { name: firstName(sib?.name ?? '') }), onPress: () => { setParentPhone(siblingParent); void submit('new', undefined, { ...opts, parentPhone: siblingParent }); } },
            ]
          : undefined);
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
   * The one box (v2): look the number up first. A student's own number → his card, one tap to
   * enrol; a parent's → the children; unknown → the form with the number in it. Offline, the form
   * as before (parked with «auto» and decided when the connection returns).
   */
  async function lookUp() {
    if (courseId == null) return;
    const phone = normalizeEgyptPhone(box);
    if (phone === null) { setBoxNote(t('fast_register.box_invalid')); return; }
    setLooking(true);
    setBoxNote(null);
    try {
      const r = await lookupRecordPhone(courseId, phone);
      if (r.outcome === 'role_conflict' || r.outcome === 'blocked') { setBoxNote(r.message); return; }
      if (r.outcome === 'unknown') { openNewForm(phone, [], 'student'); return; }
      setFound(r);
      setStep('found');
    } catch (e) {
      if (isAxiosError(e) && !e.response) {
        // No connection: today's form, exactly as before.
        openNewForm(phone, [], 'student');
        setFlash(t('fast_register.offline_form'));
        setTimeout(() => setFlash(null), 3000);
      } else {
        setBoxNote((isAxiosError(e) && e.response?.data?.message) || t('enroll_ui.record_failed'));
      }
    } finally {
      setLooking(false);
    }
  }

  /**
   * The form. A number nobody knows (neither a student nor a parent) goes in the STUDENT's box,
   * with «ده رقم ولي الأمر؟» to move it (founder 2026-11-07); a parent's number («طالب جديد على
   * نفس الرقم») goes in the parent's box.
   */
  function openNewForm(phone: string, kids: LookupChild[], box: 'student' | 'parent') {
    setName('');
    setParentPhone(box === 'parent' ? phone : '');
    setStudentPhone(box === 'student' ? phone : '');
    setParentName('');
    setRelationship(null);
    setSiblings(kids);
    setStep('form');
    setTimeout(() => nameRef.current?.focus(), 250);
  }

  /** The unknown number was the parent's: move it to the parent's box. */
  function swapNumberToParent() {
    setParentPhone(studentPhone);
    setStudentPhone('');
  }

  /** The number in the parent's box was the student's own: move it to his box. */
  function swapNumberToStudent() {
    setStudentPhone(parentPhone);
    setParentPhone('');
  }

  /** «طالب جديد» from a parent's children: if the typed first name is already one of them, ask once. */
  function saveForm() {
    const first = cleanDoorName(name).split(' ')[0];
    const twin = siblings.find((k) => k.name.trim().split(/\s+/)[0] === first);
    if (!twin) { void submit(); return; }
    Alert.alert(t('fast_register.same_name_title'), t('fast_register.same_name_body', { name: twin.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('fast_register.same_name_is_him', { name: firstName(twin.name) }), onPress: () => { void submit('link', twin.student_id, { via: { parent_phone: normalizeEgyptPhone(parentPhone) ?? '', name: twin.name } }); } },
      { text: t('fast_register.same_name_yes'), onPress: () => { void submit('new', undefined, { allowSameName: true }); } },
    ]);
  }

  /** «أضف ولي أمر» on my own student's card when he has none (v2 §12). */
  async function addParentFromCard(studentId: number) {
    const phone = normalizeEgyptPhone(addParentPhone);
    if (phone === null) { Alert.alert(t('enroll_ui.register_failed'), t('fast_register.box_invalid')); return; }
    setAddingParent(true);
    try {
      await addParentNumber(studentId, phone);
      setAddParentPhone('');
      setFound((f) => (f && f.outcome === 'student' ? { ...f, student: { ...f.student, needs_parent: false } } : f));
      setFlash(t('fast_register.add_parent_done'));
      setTimeout(() => setFlash(null), 2500);
    } catch (e) {
      Alert.alert(t('enroll_ui.register_failed'), (isAxiosError(e) && e.response?.data?.message) || t('enroll_ui.record_failed'));
    } finally {
      setAddingParent(false);
    }
  }

  /**
   * A student who already has a card, or a parent's invitation QR, is not typed in: the scan
   * goes to the enrol screen with this group chosen (and a stranger there is «دعوة طالب»).
   */
  function scanInstead() {
    router.push({ pathname: '/(teacher)/enroll', params: courseId != null ? { course_id: String(courseId) } : {} });
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: nav.pageEnd + insets.bottom + spacing.xxl }}>
        {/* The page: what it is for, how many so far, and a scan for a student who already has a card or an invitation. */}
        <Surface id="teacher.record_student.header">
        <PageHero
          title={t('enroll_ui.fast_register_title')}
          subtitle={t('fast_register.subtitle')}
          onBack
          action={{ icon: 'scan', label: t('fast_register.scan'), onPress: scanInstead, accessibilityLabel: t('fast_register.scan_hint') }}
        />
        </Surface>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4 }}>
          {/* The groups: tapping one opens the inputs for it (founder 2026-10-22). */}
          <Surface id="teacher.record_student.course_picker">
          <CoursePickCard courses={eligible} onPick={(c) => openForm(c.id)} counts={addedByCourse} />
          </Surface>

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

        </View>
      </ScrollView>

      {/* The inputs for the chosen group, in a modal; it stays open for the next student. The
          popups it can raise live INSIDE it, or iOS holds them until it closes. */}
      <Surface id="teacher.record_student.form_sheet">
      <SheetModal visible={formOpen && course != null} onClose={() => setFormOpen(false)} avoidKeyboard style={{ backgroundColor: colors.background, maxHeight: '92%', padding: 0 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }} numberOfLines={1}>{course?.name}{course?.grade_name ? ` · ${course.grade_name}` : ''}</Text>
              {course?.schedule_label ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>{course.schedule_label}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}
              style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Step 1 (v2): one box — the student's or the parent's number — looked up before any form. */}
          {step !== 'form' ? (
            <Surface id="teacher.record_student.lookup_box">
            <View style={sectionCard}>
              <StepHead n={1} icon="phone" title={t('fast_register.box_label')} />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TextInput
                  value={box}
                  onChangeText={(v) => { setBox(v); setBoxNote(null); if (step === 'found') { setStep('lookup'); setFound(null); } }}
                  placeholder="01xxxxxxxxx"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                  autoFocus
                  onSubmitEditing={() => { void lookUp(); }}
                  style={{ ...field(), flex: 1, borderColor: boxNote ? colors.danger : (box ? colors.brand : colors.borderStrong) }}
                />
                <TouchableOpacity onPress={() => { void lookUp(); }} disabled={looking || box.trim() === ''} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('fast_register.look')}
                  style={{ minWidth: 72, minHeight: control.minHeight, borderRadius: radius.lg, backgroundColor: colors.brand, opacity: box.trim() === '' ? 0.5 : 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md }}>
                  {looking ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onPrimary }}>{t('fast_register.look')}</Text>}
                </TouchableOpacity>
              </View>
              {boxNote ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.danger, marginTop: spacing.xs }}>{boxNote}</Text>
              ) : normalizeEgyptPhone(box) && normalizeEgyptPhone(box) !== box.trim() ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: spacing.xs }}>{t('fast_register.will_save', { phone: normalizeEgyptPhone(box) })}</Text>
              ) : (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginTop: spacing.xs }}>{t('fast_register.box_hint')}</Text>
              )}
              <TouchableOpacity onPress={scanInstead} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, alignSelf: 'flex-start' }}>
                <Icon name="scan" size={16} color={colors.brand} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.brand }}>{t('fast_register.scan_instead')}</Text>
              </TouchableOpacity>
            </View>
            </Surface>
          ) : null}

          {/* Step 2 (v2): what the number is — a student's card, or a parent's children. */}
          {step === 'found' && found?.outcome === 'student' ? (
            <Surface id="teacher.record_student.found_student">
            <View style={[sectionCard, { alignItems: 'center' }]}>
              <Icon name="children" size={40} color={colors.brand} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.sm }}>{found.student.name}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
                {found.student.grade ? <Pill text={found.student.grade} /> : null}
                {found.student.student_code ? <Pill text={found.student.student_code} /> : null}
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
                {found.student.already_in_target
                  ? t('enroll_ui.own_already_in_target', { course: found.student.target_course_name })
                  : found.student.is_own
                    ? t('enroll_ui.own_in_other_course', { current: found.student.current_course_name ?? '—', course: found.student.target_course_name })
                    : t('enroll_ui.own_in_system', { course: found.student.target_course_name })}
              </Text>
              {!found.student.already_in_target ? (
                <TouchableOpacity onPress={() => { void submit('link', found.student.student_id, { via: { student_phone: found.phone, name: found.student.name } }); }} disabled={saving} activeOpacity={0.85}
                  style={{ marginTop: spacing.lg, alignSelf: 'stretch', minHeight: 52, backgroundColor: colors.brand, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' }}>
                  {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.onPrimary }}>{t('enroll_ui.enroll_in_course', { course: found.student.target_course_name })}</Text>}
                </TouchableOpacity>
              ) : null}
              {found.student.needs_parent ? (
                // My own student with no parent yet: add the number right here (v2 §12).
                <View style={{ alignSelf: 'stretch', marginTop: spacing.lg }}>
                  <Text style={label()}>{t('fast_register.add_parent')}</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <TextInput value={addParentPhone} onChangeText={setAddParentPhone} placeholder="01xxxxxxxxx" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad"
                      style={{ ...field(), flex: 1, borderColor: addParentPhone ? colors.brand : colors.borderStrong }} />
                    <TouchableOpacity onPress={() => { void addParentFromCard(found.student.student_id); }} disabled={addingParent || addParentPhone.trim() === ''} activeOpacity={0.85}
                      style={{ minWidth: 72, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, opacity: addParentPhone.trim() === '' ? 0.5 : 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md }}>
                      {addingParent ? <ActivityIndicator color={colors.brand} /> : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('fast_register.add_parent_button')}</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
              <TouchableOpacity onPress={backToBox} activeOpacity={0.7} style={{ paddingVertical: spacing.md }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('fast_register.another_number')}</Text>
              </TouchableOpacity>
            </View>
            </Surface>
          ) : null}

          {step === 'found' && found?.outcome === 'parent' ? (
            <Surface id="teacher.record_student.found_children">
            <View style={sectionCard}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary, marginBottom: spacing.sm }}>
                {found.children.length ? t('fast_register.children_title') : t('fast_register.children_none')}
              </Text>
              <View style={{ gap: spacing.sm }}>
                {found.children.map((k) => (
                  <TouchableOpacity key={k.student_id} disabled={k.already_in_target || saving} activeOpacity={0.85}
                    onPress={() => { void submit('link', k.student_id, { via: { parent_phone: found.phone, name: k.name } }); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{k.name}</Text>
                      {k.is_own ? (
                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                          {[k.grade, k.current_course_name].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: k.already_in_target ? colors.textTertiary : colors.brand }}>
                      {k.already_in_target ? t('fast_register.already_here') : t('fast_register.enroll_short')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={() => openNewForm(found.phone, found.children, 'parent')} activeOpacity={0.85}
                style={{ marginTop: spacing.md, minHeight: 50, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="add" size={18} color={colors.brand} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand }}>{t('fast_register.new_sibling')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={backToBox} activeOpacity={0.7} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('fast_register.another_number')}</Text>
              </TouchableOpacity>
            </View>
            </Surface>
          ) : null}

          {/* Step 3 (v2): the form — only for a number nobody knows, or a new sibling. */}
          {step === 'form' ? (
          <>
          <TouchableOpacity onPress={backToBox} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm, alignSelf: 'flex-start' }}>
            <Icon name="back" size={14} color={colors.textSecondary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary }}>{t('fast_register.another_number')}</Text>
          </TouchableOpacity>
          {/* The student */}
          <View style={sectionCard}>
            <StepHead n={1} icon="child" title={t('fast_register.step_student')} />
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
            <Text style={label()}>{t('invite_phone.student_phone')}{parentPhone.trim() !== '' ? <Text style={{ fontFamily: fonts.regular, color: colors.textTertiary }}> {t('enroll_ui.optional_paren')}</Text> : null}</Text>
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
                : studentNorm && studentNorm !== studentPhone.trim()
                  ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }}>{t('fast_register.will_save', { phone: studentNorm })}</Text>
                  : <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary }}>{t('enroll_ui.student_phone_hint')}</Text>}
            {/* An unknown number lands here; one tap moves it if it was the parent's. */}
            {studentPhone.trim() !== '' && parentPhone.trim() === '' && siblings.length === 0 ? (
              <TouchableOpacity onPress={swapNumberToParent} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6 }} style={{ marginTop: spacing.xs, alignSelf: 'flex-start' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('fast_register.number_is_parent')}</Text>
              </TouchableOpacity>
            ) : null}
            </Surface>
          </View>

          {/* The parent — the activation anchor */}
          <View style={sectionCard}>
            <StepHead n={2} icon="phone" title={t('fast_register.step_parent')} />
            <Surface id="teacher.record_student.parent_phone">
            <Text style={label()}>{t('enroll_ui.parent_phone')} <Text style={{ fontFamily: fonts.regular, color: colors.textTertiary }}>{t('enroll_ui.optional_paren')}</Text></Text>
            <TextInput
              value={parentPhone}
              onChangeText={setParentPhone}
              placeholder="01xxxxxxxxx"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
              style={{ ...field(), marginBottom: spacing.xs, borderColor: phoneError ? colors.danger : (parentPhone ? colors.brand : colors.borderStrong) }}
              onSubmitEditing={() => { if (canSubmit) saveForm(); }}
            />
            {phoneError
              ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.danger, marginBottom: spacing.lg }}>{t('enroll_ui.phone_invalid')}</Text>
              : noPhone && name.trim() !== ''
                ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.danger, marginBottom: spacing.lg }}>{t('enroll_ui.need_one_phone')}</Text>
                : <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginBottom: spacing.lg }}>
                    {parentPhone.trim() === '' ? t('enroll_ui.parent_phone_optional_hint') : parentNorm && parentNorm !== parentPhone.trim() ? t('fast_register.will_save', { phone: parentNorm }) : t('enroll_ui.parent_phone_hint')}
                  </Text>}
            {/* A number in the parent's box that was the student's own: one tap moves it. */}
            {parentPhone.trim() !== '' && studentPhone.trim() === '' && siblings.length === 0 ? (
              <TouchableOpacity onPress={swapNumberToStudent} activeOpacity={0.7} style={{ marginTop: -spacing.sm, marginBottom: spacing.lg, alignSelf: 'flex-start' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('fast_register.number_is_student')}</Text>
              </TouchableOpacity>
            ) : null}
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
          <TouchableOpacity onPress={saveForm} disabled={!canSubmit} activeOpacity={0.85} accessibilityRole="button"
            style={{ marginTop: spacing.md, opacity: canSubmit ? 1 : 0.5, backgroundColor: colors.brand, borderRadius: radius.lg, minHeight: 56, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, ...shadows.sm }}>
            {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="add" size={20} color={colors.onPrimary} />}
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('enroll_ui.save_next')}</Text>
          </TouchableOpacity>
          </Surface>
          </>
          ) : null}

          {flash ? (
            <Surface id="teacher.record_student.flash">
            <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.successLight, borderRadius: radius.lg, padding: spacing.md }}>
              <Icon name="success" size={20} color={colors.successText} />
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.successText }}>{flash}</Text>
            </View>
            </Surface>
          ) : null}

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
            student={ownStudent && !ownStudent.is_own && !ownStudent.already_in_target && !ownStudent.other_child ? { name: ownStudent.name, grade: ownStudent.grade, via: 'card' } : null}
            course={ownStudent?.target_course_name ?? course?.name ?? null}
            busy={saving}
            onEnroll={() => ownStudent && submit('link', ownStudent.student_id)}
            onClose={() => setOwnStudent(null)}
          />
          </Surface>

          {/* QR-style popup — the entered phone is already one of THIS teacher's students.
              Same shape the scanner shows on a "wrong group" card: profile + enroll-here. */}
          <Surface id="teacher.record_student.existing_modal">
          <Modal visible={ownStudent !== null && (!!ownStudent.is_own || !!ownStudent.already_in_target || !!ownStudent.other_child)} transparent animationType="fade" onRequestClose={() => setOwnStudent(null)}>
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
                  {ownStudent?.other_child
                    ? t(parentPhone.trim() ? 'enroll_ui.other_child_body' : 'enroll_ui.other_child_body_no_parent', { owner: ownStudent.name, typed: name.trim() })
                    : ownStudent?.already_in_target
                    ? t('enroll_ui.own_already_in_target', { course: ownStudent?.target_course_name })
                    : ownStudent?.is_own
                      ? t('enroll_ui.own_in_other_course', { current: ownStudent?.current_course_name ?? '—', course: ownStudent?.target_course_name })
                      : t('enroll_ui.own_in_system', { course: ownStudent?.target_course_name })}
                </Text>

                {saving ? (
                  <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} />
                ) : ownStudent?.other_child ? (
                  <>
                    {parentPhone.trim() ? (
                      <TouchableOpacity onPress={() => submit('new', undefined, { withoutStudentPhone: true })} activeOpacity={0.85} style={{ marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.md, alignItems: 'center', alignSelf: 'stretch' }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff', textAlign: 'center' }}>{t('enroll_ui.other_child_record_new', { typed: firstName(name) })}</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => { setStudentPhone(''); setOwnStudent(null); }} activeOpacity={0.85} style={{ marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', alignSelf: 'stretch' }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('enroll_ui.other_child_clear_phone')}</Text>
                      </TouchableOpacity>
                    )}
                    {!ownStudent.already_in_target ? (
                      <TouchableOpacity onPress={() => submit('link', ownStudent.student_id)} activeOpacity={0.85} style={{ marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.md, alignItems: 'center', alignSelf: 'stretch' }}>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, textAlign: 'center' }}>{t('enroll_ui.other_child_is_owner', { owner: firstName(ownStudent.name), course: ownStudent.target_course_name })}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity onPress={() => setOwnStudent(null)} activeOpacity={0.7} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                  </>
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
      </SheetModal>
      </Surface>
    </View>
    </Surface>
  );
}

/** A small grey chip: the grade, the code. */
function Pill({ text }: { text: string }) {
  return (
    <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{text}</Text>
    </View>
  );
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? '';
}

/** A numbered section head: the order a teacher fills the form in. */
