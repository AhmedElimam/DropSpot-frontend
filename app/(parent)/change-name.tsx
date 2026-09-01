import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, control } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { isArabicName } from '@/utils/validators';
import { updateMyName } from '@/api/profile';

/**
 * Tier A — a parent corrects their OWN display name. Direct self-edit (self-owned account),
 * no teacher review. Applies immediately and refreshes the session so the header updates.
 */
export default function ChangeNameScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const setSession = useAuthStore((s) => s.setSession);

  // Prefill from the current name: first token → first name, the rest → last name.
  const parts = (user?.name ?? '').trim().split(/\s+/).filter(Boolean);
  const [first, setFirst] = useState(parts[0] ?? '');
  const [last, setLast] = useState(parts.slice(1).join(' '));

  const save = useMutation({
    mutationFn: () => updateMyName({ first_name: first.trim(), last_name: last.trim() || undefined }),
    onSuccess: async (d) => {
      if (user && role) await setSession({ ...user, name: d.name }, role);
      Alert.alert('', 'تم تحديث اسمك بنجاح.', [{ text: 'حسنًا', onPress: () => router.back() }]);
    },
    onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)),
  });

  const onSave = () => {
    if (first.trim().length < 2) { Alert.alert('', 'الاسم الأول مطلوب'); return; }
    if (!isArabicName(first) || !isArabicName(last)) { Alert.alert('', 'يُرجى كتابة الاسم بالعربية فقط'); return; }
    save.mutate();
  };

  const input = {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.medium, fontSize: 16,
    color: colors.textPrimary, textAlign: 'right' as const, marginBottom: spacing.md,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>تعديل الاسم</Text>
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 22 }}>
            عدّل اسمك كما يظهر لمعلّمي أبنائك. يُطبَّق فورًا.
          </Text>

          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, textAlign: 'right' }}>الاسم الأول *</Text>
          <TextInput value={first} onChangeText={setFirst} placeholder="الاسم الأول" placeholderTextColor={colors.textTertiary} style={input} />

          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, textAlign: 'right' }}>الاسم الأخير</Text>
          <TextInput value={last} onChangeText={setLast} placeholder="اترك فارغًا إن لم يوجد" placeholderTextColor={colors.textTertiary} style={input} />

          <TouchableOpacity onPress={onSave} disabled={save.isPending} activeOpacity={0.85}
            style={{ backgroundColor: colors.primary, borderRadius: radius.lg, minHeight: control.minHeight, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, opacity: save.isPending ? 0.6 : 1 }}>
            {save.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>حفظ</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
