import { useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform, Alert,
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
import { getInvitationOptions, type InvitationCourseOption } from '@/api/invitation';
import { recordStudent, orderCardsForNewlyAdded, type DedupeMatch, type RecordStudentPayload } from '@/api/studentRecord';

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
  const [parentPhone, setParentPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [count, setCount] = useState(0);
  const [enrollmentIds, setEnrollmentIds] = useState<number[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [dedupe, setDedupe] = useState<{ matches: DedupeMatch[]; payload: RecordStudentPayload } | null>(null);
  const [orderingCards, setOrderingCards] = useState(false);

  const eligible = useMemo(() => (options?.courses ?? []).filter((c) => c.has_schedule), [options]);
  const course = useMemo(() => eligible.find((c) => c.id === courseId) ?? null, [eligible, courseId]);

  const nameError = name.trim() !== '' && !isArabicName(name);
  const phoneError = parentPhone.trim() !== '' && !isEgyptPhone(parentPhone);
  const canSubmit = courseId != null && isArabicName(name.trim()) && isEgyptPhone(parentPhone.trim()) && !saving;

  function afterCreated(enrollmentId: number | null) {
    setCount((c) => c + 1);
    if (enrollmentId) setEnrollmentIds((ids) => [...ids, enrollmentId]);
    setName('');
    setParentPhone('');
    setFlash(`تم إضافة ${count + 1} طالب`);
    setTimeout(() => setFlash(null), 1800);
    nameRef.current?.focus();
  }

  async function submit(decision?: 'new' | 'link', linkStudentId?: number) {
    if (courseId == null) return;
    const payload: RecordStudentPayload = {
      student_name: name.trim(),
      parent_phone: parentPhone.trim(),
      course_id: courseId,
      ...(decision ? { dedupe_decision: decision } : {}),
      ...(linkStudentId ? { link_student_id: linkStudentId } : {}),
    };
    setSaving(true);
    try {
      const res = await recordStudent(payload);
      setDedupe(null);
      afterCreated(res.enrollment_id);
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 409 && e.response.data?.code === 'DEDUPE_REQUIRED') {
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

  async function bulkOrderCards() {
    if (enrollmentIds.length === 0) return;
    setOrderingCards(true);
    try {
      const r = await orderCardsForNewlyAdded(enrollmentIds);
      Alert.alert('تم', `تم إنشاء ${r.created} طلب بطاقة${r.skipped ? ` (تم تخطّي ${r.skipped})` : ''}.`);
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
                <TouchableOpacity key={c.id} onPress={() => setCourseId(c.id)} activeOpacity={0.85}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: selected ? colors.brandTint : colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1.5, borderColor: selected ? colors.brand : 'transparent' }}>
                  <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{c.name}{c.grade_name ? ` · ${c.grade_name}` : ''}</Text>
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
    </KeyboardAvoidingView>
  );
}
