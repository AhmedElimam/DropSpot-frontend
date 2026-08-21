import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { getTeacherStudents, getStudentDetail, orderCardForEnrollment, type StudentCourse } from '@/api/students';

/**
 * Order a card for an EXISTING enrollment (a student already on the roster). Pick the
 * student → pick which of their enrollments the card is for → delivery address +
 * payment (COD, or pay-now with a proof screenshot). Posts to /teacher/card-orders.
 */
export default function CardOrderNew() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [studentId, setStudentId] = useState<string | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [payment, setPayment] = useState<'cash_on_delivery' | 'pay_now'>('cash_on_delivery');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const roster = useQuery({ queryKey: ['teacher-students-all'], queryFn: () => getTeacherStudents() });
  const detail = useQuery({
    queryKey: ['student-detail', studentId],
    queryFn: () => getStudentDetail(studentId as string),
    enabled: !!studentId,
  });

  const filtered = (roster.data ?? []).filter((s) => {
    const q = search.trim().toLowerCase();
    return !q || (s.name ?? '').toLowerCase().includes(q) || (s.student_code ?? '').toLowerCase().includes(q);
  });
  const enrollableCourses = (detail.data?.courses ?? []).filter((c: StudentCourse) => !!c.enrollment_id);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) setImageUri(result.assets[0].uri);
  };

  const canSubmit = !!enrollmentId && address.trim().length >= 10 && (payment === 'cash_on_delivery' || !!imageUri) && !busy;

  const submit = async () => {
    if (!enrollmentId) return;
    setBusy(true);
    try {
      await orderCardForEnrollment({ enrollment_id: enrollmentId, delivery_address: address.trim(), payment_option: payment, imageUri });
      qc.invalidateQueries({ queryKey: ['teacher-card-orders'] });
      Alert.alert('', t('teacher.co_order_submitted'), [{ text: t('common.close'), onPress: () => router.back() }]);
    } catch {
      Alert.alert(t('common.error'), t('teacher.co_order_failed'));
    } finally {
      setBusy(false);
    }
  };

  const PICK_STYLE = { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.order_card')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
        {/* Step 1 — student */}
        <Label text={t('teacher.pick_student')} />
        {!studentId ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
              <Icon name="search" size={18} color={colors.textTertiary} />
              <TextInput value={search} onChangeText={setSearch} placeholder={t('teacher.search_student_ph')} placeholderTextColor={colors.textTertiary}
                style={{ flex: 1, height: 46, marginStart: spacing.sm, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }} />
            </View>
            {roster.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : (
              filtered.slice(0, 30).map((s) => (
                <TouchableOpacity key={s.id} onPress={() => { setStudentId(s.id); setEnrollmentId(null); }} activeOpacity={0.8} style={PICK_STYLE}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{s.name ?? '—'}</Text>
                  {s.grade_name ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{s.grade_name}</Text> : null}
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          <TouchableOpacity onPress={() => { setStudentId(null); setEnrollmentId(null); }} activeOpacity={0.8} style={{ ...PICK_STYLE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderColor: colors.brand }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{roster.data?.find((s) => s.id === studentId)?.name ?? '—'}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        )}

        {/* Step 2 — enrollment */}
        {studentId ? (
          <>
            <Label text={t('teacher.pick_enrollment')} />
            {detail.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} /> : (
              enrollableCourses.map((c) => {
                const active = enrollmentId === c.enrollment_id;
                return (
                  <TouchableOpacity key={c.enrollment_id} onPress={() => setEnrollmentId(c.enrollment_id ?? null)} activeOpacity={0.8}
                    style={{ ...PICK_STYLE, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brand + '12' : colors.surface }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{c.name ?? '—'}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        ) : null}

        {/* Step 3 — delivery + payment */}
        {enrollmentId ? (
          <>
            <Label text={t('teacher.co_delivery_address')} />
            <TextInput value={address} onChangeText={setAddress} placeholder={t('teacher.co_delivery_ph')} placeholderTextColor={colors.textTertiary} multiline
              style={{ minHeight: 70, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right', textAlignVertical: 'top' }} />

            <Label text={t('teacher.co_payment_method')} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {(['cash_on_delivery', 'pay_now'] as const).map((p) => (
                <TouchableOpacity key={p} onPress={() => setPayment(p)} activeOpacity={0.85}
                  style={{ flex: 1, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: payment === p ? colors.brand : colors.border, backgroundColor: payment === p ? colors.brand + '12' : colors.surface, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: payment === p ? colors.brand : colors.textSecondary }}>
                    {t(p === 'cash_on_delivery' ? 'teacher.co_pay_cod' : 'teacher.co_pay_now')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {payment === 'pay_now' ? (
              <TouchableOpacity onPress={pickImage} activeOpacity={0.8}
                style={{ borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm }}>
                {imageUri ? (
                  <>
                    <Image source={{ uri: imageUri }} style={{ width: '100%', height: 160, borderRadius: radius.sm, resizeMode: 'contain' }} />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.success, marginTop: spacing.sm }}>{t('teacher.co_proof_selected')}</Text>
                  </>
                ) : (
                  <>
                    <Icon name="invoices" size={26} color={colors.textSecondary} />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm }}>{t('teacher.co_pick_proof')}</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity onPress={submit} disabled={!canSubmit} activeOpacity={0.85}
              style={{ marginTop: spacing.xl, minHeight: 50, borderRadius: radius.lg, backgroundColor: canSubmit ? colors.primary : colors.border, justifyContent: 'center', alignItems: 'center' }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('teacher.co_submit_order')}</Text>}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.lg, marginBottom: spacing.sm }}>{text}</Text>;
}
