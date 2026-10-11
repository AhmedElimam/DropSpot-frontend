import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView } from 'react-native';
import { Alert } from '@/ui/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, control } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { isArabicName } from '@/utils/validators';
import { updateMyName, confirmMyName } from '@/api/profile';
import { PageHero } from '@/components/ui/PageHero';

/**
 * Tier A — a parent corrects their OWN display name. Direct self-edit (self-owned
 * account), no teacher review. Applies immediately and refreshes the session so the
 * header updates.
 *
 * `?first=1` is the FIRST-LOGIN visit routed from app/index.tsx: a parent's name is
 * normally derived from a child's (the teacher who recorded them only had a phone
 * number), so this is the one moment they get to fix it. That variant explains why it
 * is asking, offers "my name is correct" alongside saving, and has no back button —
 * there is nothing behind it to go back to. Both answers clear the prompt for good.
 */
export default function ChangeNameScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const setSession = useAuthStore((s) => s.setSession);
  const isFirstLogin = useLocalSearchParams<{ first?: string }>().first === '1';

  // Leaving the prompt enters the app. The parent stack always has the tabs underneath
  // (initialRouteName), so going back lands on Home on a first login too.
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(parent)/(tabs)');
  };

  // Prefill from the current name: first token → first name, the rest → last name.
  const parts = (user?.name ?? '').trim().split(/\s+/).filter(Boolean);
  const [first, setFirst] = useState(parts[0] ?? '');
  const [last, setLast] = useState(parts.slice(1).join(' '));

  const save = useMutation({
    mutationFn: () => updateMyName({ first_name: first.trim(), last_name: last.trim() || undefined }),
    onSuccess: async (d) => {
      if (user && role) await setSession({ ...user, name: d.name, should_confirm_name: false }, role);
      Alert.alert('', t('family_ui.name_updated'), [{ text: t('common.ok'), onPress: leave }]);
    },
    onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)),
  });

  // "It's already right" — clears the prompt without making them retype a correct name.
  const confirm = useMutation({
    mutationFn: confirmMyName,
    onSuccess: async () => {
      if (user && role) await setSession({ ...user, should_confirm_name: false }, role);
      leave();
    },
    onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)),
  });

  const onSave = () => {
    if (first.trim().length < 2) { Alert.alert('', t('family_ui.first_name_required')); return; }
    if (!isArabicName(first) || !isArabicName(last)) { Alert.alert('', t('family_ui.arabic_name_only')); return; }
    save.mutate();
  };

  const input = {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.medium, fontSize: 16,
    color: colors.textPrimary, textAlign: 'right' as const, marginBottom: spacing.md,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PageHero title={isFirstLogin ? t('family_ui.confirm_name_title') : t('family_ui.edit_name')} onBack={!isFirstLogin} compact />

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 22 }}>
            {isFirstLogin
              ? t('family_ui.confirm_name_intro')
              : t('family_ui.edit_name_intro')}
          </Text>

          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('family_ui.first_name_required_label')}</Text>
          <TextInput value={first} onChangeText={setFirst} placeholder={t('family_ui.first_name')} placeholderTextColor={colors.textTertiary} style={input} />

          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('family_ui.last_name')}</Text>
          <TextInput value={last} onChangeText={setLast} placeholder={t('family_ui.leave_blank_none')} placeholderTextColor={colors.textTertiary} style={input} />

          <TouchableOpacity onPress={onSave} disabled={save.isPending} activeOpacity={0.85}
            style={{ backgroundColor: colors.primary, borderRadius: radius.lg, minHeight: control.minHeight, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, opacity: save.isPending ? 0.6 : 1 }}>
            {save.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{isFirstLogin ? t('family_ui.save_correct_name') : t('common.save')}</Text>}
          </TouchableOpacity>

          {isFirstLogin ? (
            <TouchableOpacity onPress={() => confirm.mutate()} disabled={confirm.isPending} activeOpacity={0.85}
              accessibilityRole="button"
              style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, minHeight: control.minHeight, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, opacity: confirm.isPending ? 0.6 : 1 }}>
              {confirm.isPending
                ? <ActivityIndicator color={colors.textSecondary} />
                : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textSecondary }}>{t('family_ui.name_is_correct')}</Text>}
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
