import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { submitMyNameCorrection, submitChildNameCorrection } from '@/api/students';

/**
 * Tier B — a student requests a correction to THEIR OWN name, or a parent for a CHILD
 * (when `studentId` is passed). It's reviewed by the student's teacher(s) via the
 * resolution centre; nothing changes until a teacher approves.
 */
export default function RequestNameCorrectionScreen() {
  const insets = useSafeAreaInsets();
  const { studentId, studentName } = useLocalSearchParams<{ studentId?: string; studentName?: string }>();
  const forChild = !!studentId;

  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [reason, setReason] = useState('');

  const submit = useMutation({
    mutationFn: () => {
      const payload = { first_name: first.trim() || undefined, last_name: last.trim() || undefined, reason: reason.trim() };
      return forChild ? submitChildNameCorrection(studentId!, payload) : submitMyNameCorrection(payload);
    },
    onSuccess: () => {
      Alert.alert('تم الإرسال', 'تم إرسال طلب التصحيح لمراجعة المعلّم. سيُطبّق بعد الاعتماد.', [
        { text: 'حسنًا', onPress: () => router.back() },
      ]);
    },
    onError: (e: any) => Alert.alert('تعذّر الإرسال', e?.response?.data?.message || 'حدث خطأ'),
  });

  const onSubmit = () => {
    if (!first.trim() && !last.trim()) { Alert.alert('', 'حدّد الاسم الجديد على الأقل'); return; }
    if (reason.trim().length < 3) { Alert.alert('', 'يرجى توضيح سبب التصحيح'); return; }
    submit.mutate();
  };

  const input = {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.medium, fontSize: 15,
    color: colors.textPrimary, textAlign: 'right' as const, marginBottom: spacing.md,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>طلب تصحيح الاسم</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 22 }}>
            {forChild
              ? `اطلب تصحيح اسم «${studentName ?? 'الطالب'}». يراجع المعلّم الطلب قبل تطبيقه.`
              : 'اطلب تصحيح اسمك. يراجع معلّمك الطلب قبل تطبيقه — لن يتغيّر شيء حتى يعتمده.'}
          </Text>

          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, textAlign: 'right' }}>الاسم الأول</Text>
          <TextInput value={first} onChangeText={setFirst} placeholder="اترك فارغًا إن لم يتغيّر" placeholderTextColor={colors.textTertiary} style={input} />

          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, textAlign: 'right' }}>الاسم الأخير</Text>
          <TextInput value={last} onChangeText={setLast} placeholder="اترك فارغًا إن لم يتغيّر" placeholderTextColor={colors.textTertiary} style={input} />

          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, textAlign: 'right' }}>سبب التصحيح *</Text>
          <TextInput value={reason} onChangeText={setReason} multiline placeholder="مثال: خطأ إملائي في الاسم" placeholderTextColor={colors.textTertiary}
            style={[input, { minHeight: 84, textAlignVertical: 'top' }]} />

          <TouchableOpacity onPress={onSubmit} disabled={submit.isPending} activeOpacity={0.85}
            style={{ backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.sm, opacity: submit.isPending ? 0.6 : 1 }}>
            {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>إرسال للمراجعة</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
