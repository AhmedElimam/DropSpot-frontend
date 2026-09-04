import { useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform, Alert, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, control, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/ErrorState';
import { isArabicName, isEgyptPhone } from '@/utils/validators';
import { getInvitationOptions, type InvitationCourseOption, type BookingSecures } from '@/api/invitation';
import { recordStudent, orderCardsForNewlyAdded, type DedupeMatch, type RecordStudentPayload, type ParentRelationship, type ExistingStudentOffer } from '@/api/studentRecord';

const SECURES: { key: BookingSecures; label: string }[] = [
  { key: 'session', label: 'الحصص' },
  { key: 'booklet', label: 'الملزمة' },
  { key: 'flat', label: 'حجز مبدئي' },
];

const label = { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs } as const;
const field = {
  fontFamily: fonts.regular, fontSize: 17, minHeight: control.minHeight,
  backgroundColor: colors.surfaceSunken, borderRadius: radius.lg,
  paddingHorizontal: spacing.lg, paddingVertical: 14, color: colors.textPrimary,
  textAlign: 'right' as const, borderWidth: 1.5,
};

export default function RecordStudent() {
  const insets = useSafeAreaInsets();
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
  // Booking down-payment (دفعة) — per-student, seeded from the teacher's default.
  const [bookingOn, setBookingOn] = useState(false);
  const [secures, setSecures] = useState<BookingSecures | null>(null);
  const [downPayment, setDownPayment] = useState('');
  const [downPaid, setDownPaid] = useState('');
  const [saving, setSaving] = useState(false);
  const [count, setCount] = useState(0);
  const [enrollmentIds, setEnrollmentIds] = useState<number[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [dedupe, setDedupe] = useState<{ matches: DedupeMatch[]; payload: RecordStudentPayload } | null>(null);
  // QR-style popup: the entered student phone already exists in the system.
  const [ownStudent, setOwnStudent] = useState<ExistingStudentOffer | null>(null);
  const [orderingCards, setOrderingCards] = useState(false);

  const eligible = useMemo(() => (options?.courses ?? []).filter((c) => c.has_schedule), [options]);
  const course = useMemo(() => eligible.find((c) => c.id === courseId) ?? null, [eligible, courseId]);

  const nameError = name.trim() !== '' && !isArabicName(name);
  const phoneError = parentPhone.trim() !== '' && !isEgyptPhone(parentPhone);
  // The student's own phone — required: they sign in with it when the app launches.
  const studentPhoneError = studentPhone.trim() !== '' && !isEgyptPhone(studentPhone);
  const sameAsParentError =
    studentPhone.trim() !== '' && parentPhone.trim() !== '' && studentPhone.trim() === parentPhone.trim();
  const canSubmit =
    courseId != null &&
    isArabicName(name.trim()) &&
    isEgyptPhone(studentPhone.trim()) &&
    isEgyptPhone(parentPhone.trim()) &&
    !sameAsParentError &&
    !saving;

  function afterCreated(enrollmentId: number | null) {
    setCount((c) => c + 1);
    if (enrollmentId) setEnrollmentIds((ids) => [...ids, enrollmentId]);
    setName('');
    setStudentPhone('');
    setParentPhone('');
    setParentName('');
    setRelationship(null);
    // Keep the booking toggle + secures across students of the same course; only the
    // per-student amounts reset.
    setDownPayment('');
    setDownPaid('');
    setFlash(`تم إضافة ${count + 1} طالب`);
    setTimeout(() => setFlash(null), 1800);
    nameRef.current?.focus();
  }

  async function submit(decision?: 'new' | 'link', linkStudentId?: number) {
    if (courseId == null) return;
    // Down-payment: OFF → explicit waive (send null); ON with an amount → that amount;
    // ON but blank → omit so the teacher's default applies.
    const dpProvided = !bookingOn || downPayment.trim() !== '';
    const payload: RecordStudentPayload = {
      student_name: name.trim(),
      student_phone: studentPhone.trim(),
      parent_phone: parentPhone.trim(),
      ...(parentName.trim() ? { parent_name: parentName.trim() } : {}),
      ...(relationship ? { relationship } : {}),
      ...(dpProvided
        ? {
            down_payment_amount: !bookingOn || downPayment.trim() === '' ? null : Number(downPayment),
            down_payment_paid: !bookingOn || downPaid.trim() === '' ? null : Number(downPaid),
            booking_secures: secures ?? options?.default_secures,
          }
        : {}),
      course_id: courseId,
      ...(decision ? { dedupe_decision: decision } : {}),
      ...(linkStudentId ? { link_student_id: linkStudentId } : {}),
    };
    setSaving(true);
    try {
      const res = await recordStudent(payload);
      setDedupe(null);
      setOwnStudent(null);
      afterCreated(res.enrollment_id);
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 409 && e.response.data?.code === 'EXISTING_STUDENT') {
        // The student phone already exists → show the QR-style profile popup;
        // "enroll here" re-posts as a link into the chosen course.
        setOwnStudent(e.response.data.errors?.offer ?? null);
      } else if (isAxiosError(e) && e.response?.status === 409 && e.response.data?.code === 'DEDUPE_REQUIRED') {
        setDedupe({ matches: e.response.data.errors?.matches ?? [], payload });
      } else if (isAxiosError(e) && e.response?.status === 422) {
        Alert.alert('تعذّر التسجيل', e.response.data?.message ?? 'تحقّق من البيانات المُدخلة.');
      } else {
        Alert.alert('خطأ', 'تعذّر تسجيل الطالب. حاول مرة أخرى.');
      }
    } finally {
      setSaving(false);
    }
  }

  /**
   * Card ordering is a SEPARATE, confirmed action — recording a student never orders a
   * card on its own. The confirmation names the count so a tap can't quietly file a
   * batch of print jobs.
   */
  function bulkOrderCards() {
    if (enrollmentIds.length === 0) return;
    Alert.alert(
      'طلب بطاقات',
      `سيتم إنشاء طلب بطاقة لـ ${enrollmentIds.length} من الطلاب المُضافين. الطالب الذي لديه بطاقة أو طلب قائم سيُتخطّى.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'اطلب البطاقات', onPress: submitCardOrders },
      ],
    );
  }

  async function submitCardOrders() {
    setOrderingCards(true);
    try {
      const r = await orderCardsForNewlyAdded(enrollmentIds);
      const parts = [`تم إنشاء ${r.created} طلب بطاقة`];
      // A student may already be covered by another teacher's order — one card serves
      // every teacher, so we say it plainly without naming who ordered it.
      if (r.already_ordered) parts.push(`${r.already_ordered} لديهم بطاقة أو طلب قائم بالفعل`);
      Alert.alert('تم', parts.join('\n'));
      setEnrollmentIds([]);
    } catch {
      Alert.alert('خطأ', 'تعذّر طلب البطاقات.');
    } finally {
      setOrderingCards(false);
    }
  }

  if (isLoading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.brand} /></View>;
  }
  if (isError) {
    return <ErrorState onRetry={refetch} />;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">
        {/* Header + running count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <TouchableOpacity onPress={() => router.back()}><Icon name="forward" size={26} color={colors.textSecondary} /></TouchableOpacity>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>تسجيل سريع للطلاب</Text>
          <View style={{ backgroundColor: colors.brandTint, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{count}</Text>
          </View>
        </View>

        {/* Course picker (choose once) */}
        <Text style={label}>المقرر</Text>
        {eligible.length === 0 ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary, marginBottom: spacing.lg }}>لا توجد مقررات لها مواعيد. أضِف موعدًا للمقرر أولًا.</Text>
        ) : (
          <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
            {eligible.map((c: InvitationCourseOption) => {
              const selected = c.id === courseId;
              return (
                <TouchableOpacity key={c.id} onPress={() => { setCourseId(c.id); setBookingOn(!!options?.requires_down_payment); setSecures(options?.default_secures ?? null); }} activeOpacity={0.85}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: selected ? colors.brandTint : colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1.5, borderColor: selected ? colors.brand : 'transparent' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{c.name}{c.grade_name ? ` · ${c.grade_name}` : ''}</Text>
                    {c.schedule_label ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{c.schedule_label}</Text> : null}
                  </View>
                  {selected ? <Icon name="success" size={20} color={colors.brand} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {courseId != null && (
          <>
            {/* Student name */}
            <Text style={label}>اسم الطالب</Text>
            <TextInput
              ref={nameRef}
              value={name}
              onChangeText={setName}
              placeholder="الاسم الكامل"
              placeholderTextColor={colors.textTertiary}
              style={{ ...field, marginBottom: spacing.xs, borderColor: nameError ? colors.danger : (name ? colors.brand : colors.borderStrong) }}
              returnKeyType="next"
            />
            {nameError ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.danger, marginBottom: spacing.md }}>يرجى إدخال الاسم بالعربية</Text> : <View style={{ height: spacing.md }} />}

            {/* Student's own phone — their login handle when the app launches */}
            <Text style={label}>رقم هاتف الطالب</Text>
            <TextInput
              value={studentPhone}
              onChangeText={setStudentPhone}
              placeholder="01xxxxxxxxx"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
              style={{ ...field, marginBottom: spacing.xs, borderColor: (studentPhoneError || sameAsParentError) ? colors.danger : (studentPhone ? colors.brand : colors.borderStrong) }}
              returnKeyType="next"
            />
            {sameAsParentError
              ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.danger, marginBottom: spacing.md }}>رقم الطالب لا يمكن أن يطابق رقم ولي الأمر</Text>
              : studentPhoneError
                ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.danger, marginBottom: spacing.md }}>رقم هاتف غير صحيح</Text>
                : <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginBottom: spacing.md }}>يسجّل الطالب الدخول بهذا الرقم عند إطلاق التطبيق.</Text>}

            {/* Parent phone — the activation anchor */}
            <Text style={label}>رقم ولي الأمر</Text>
            <TextInput
              value={parentPhone}
              onChangeText={setParentPhone}
              placeholder="01xxxxxxxxx"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
              style={{ ...field, marginBottom: spacing.xs, borderColor: phoneError ? colors.danger : (parentPhone ? colors.brand : colors.borderStrong) }}
              onSubmitEditing={() => canSubmit && submit()}
            />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginBottom: spacing.lg }}>سيُستخدم هذا الرقم لتنشيط حساب الطالب لاحقًا.</Text>

            {/* Parent name — OPTIONAL (the parent can set/modify it at setup). */}
            <Text style={label}>اسم ولي الأمر (اختياري)</Text>
            <TextInput
              value={parentName}
              onChangeText={setParentName}
              placeholder="الاسم الكامل"
              placeholderTextColor={colors.textTertiary}
              style={{ ...field, marginBottom: spacing.lg, borderColor: parentName ? colors.brand : colors.borderStrong }}
            />

            {/* Relationship — OPTIONAL, tap to toggle. */}
            <Text style={label}>صلة القرابة (اختياري)</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
              {([['father', 'أب'], ['mother', 'أم'], ['guardian', 'ولي أمر']] as const).map(([value, ar]) => {
                const active = relationship === value;
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setRelationship(active ? null : value)}
                    activeOpacity={0.85}
                    style={{
                      flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.lg, borderWidth: 1.5,
                      borderColor: active ? colors.brand : colors.borderStrong,
                      backgroundColor: active ? colors.brandTint : colors.surface,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: active ? colors.brand : colors.textSecondary }}>{ar}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Booking down-payment (دفعة) — per-student, seeded from the teacher default. */}
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>دفعة الحجز</Text>
                <Switch value={bookingOn} onValueChange={setBookingOn} trackColor={{ true: colors.brand, false: colors.border }} />
              </View>
              {bookingOn ? (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={label}>يؤمّن الحجز</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
                    {SECURES.map((s) => {
                      const active = (secures ?? options?.default_secures) === s.key;
                      return (
                        <TouchableOpacity key={s.key} onPress={() => setSecures(s.key)} activeOpacity={0.8}
                          style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: active ? colors.brand : colors.borderStrong, backgroundColor: active ? colors.brandTint : colors.surface }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? colors.brand : colors.textSecondary }}>{s.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={label}>قيمة الدفعة</Text>
                  <TextInput value={downPayment} onChangeText={(v) => setDownPayment(v.replace(/[^0-9.]/g, ''))} keyboardType="numeric"
                    placeholder={course?.booking_price != null ? String(course.booking_price) : 'المبلغ'} placeholderTextColor={colors.textTertiary}
                    style={{ ...field, marginBottom: spacing.xs }} />
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginBottom: spacing.md }}>اتركها فارغة لاستخدام السعر الافتراضي.</Text>
                  <Text style={label}>المدفوع الآن (اختياري)</Text>
                  <TextInput value={downPaid} onChangeText={(v) => setDownPaid(v.replace(/[^0-9.]/g, ''))} keyboardType="numeric"
                    placeholder="0" placeholderTextColor={colors.textTertiary} style={{ ...field, marginBottom: spacing.xs }} />
                </View>
              ) : null}
            </View>

            {/* Save */}
            <TouchableOpacity onPress={() => submit()} disabled={!canSubmit} activeOpacity={0.85}
              style={{ opacity: canSubmit ? 1 : 0.5, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
              {saving ? <ActivityIndicator color="#fff" /> : <Icon name="add" size={20} color="#fff" />}
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>حفظ والتالي</Text>
            </TouchableOpacity>

            {flash ? (
              <View style={{ marginTop: spacing.md, backgroundColor: '#e7f7ee', borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#0f7a48' }}>✅ {flash}</Text>
              </View>
            ) : null}

            {/* Bulk card order for everyone added this session */}
            {enrollmentIds.length > 0 ? (
              <TouchableOpacity onPress={bulkOrderCards} disabled={orderingCards} activeOpacity={0.85}
                style={{ marginTop: spacing.lg, borderWidth: 1.5, borderColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
                {orderingCards ? <ActivityIndicator color={colors.brand} /> : <Icon name="card" size={18} color={colors.brand} />}
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand }}>اطلب بطاقات للطلاب المُضافين ({enrollmentIds.length})</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Dedupe modal — a student with this parent phone already exists */}
      <Modal visible={dedupe !== null} transparent animationType="fade" onRequestClose={() => setDedupe(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, marginBottom: spacing.sm }}>يوجد طالب بنفس رقم ولي الأمر</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md }}>يمكنك ربط الطالب الحالي بهذا المقرر، أو إنشاء طالب جديد.</Text>
            <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
              {(dedupe?.matches ?? []).map((m) => (
                <TouchableOpacity key={m.id} onPress={() => submit('link', m.id)} activeOpacity={0.85}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary }}>{m.name}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand, marginStart: spacing.sm }}>ربط ←</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => submit('new')} activeOpacity={0.85} style={{ backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>إنشاء طالب جديد</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDedupe(null)} activeOpacity={0.7} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* QR-style popup — the entered phone is already one of THIS teacher's students.
          Same shape the scanner shows on a "wrong group" card: profile + enroll-here. */}
      <Modal visible={ownStudent !== null} transparent animationType="fade" onRequestClose={() => setOwnStudent(null)}>
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
                ? `هذا الطالب مسجّل معك بالفعل في «${ownStudent?.target_course_name}».`
                : ownStudent?.is_own
                  ? `هذا الطالب مسجّل معك في «${ownStudent?.current_course_name ?? '—'}». هل تريد إضافته إلى «${ownStudent?.target_course_name}»؟`
                  : `هذا الطالب مسجّل بالفعل في النظام. هل تريد إضافته إلى «${ownStudent?.target_course_name}»؟`}
            </Text>

            {saving ? (
              <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} />
            ) : ownStudent?.already_in_target ? (
              <TouchableOpacity onPress={() => setOwnStudent(null)} activeOpacity={0.85} style={{ marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>حسنًا</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={() => ownStudent && submit('link', ownStudent.student_id)} activeOpacity={0.85} style={{ marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', alignSelf: 'stretch' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>تسجيله في «{ownStudent?.target_course_name}»</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setOwnStudent(null)} activeOpacity={0.7} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>إلغاء</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
