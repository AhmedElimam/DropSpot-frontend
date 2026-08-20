import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients, control, shadows, layout } from '@/theme/index';
import { useChangePassword } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { Icon } from '@/components/ui/Icon';

const label = { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginBottom: spacing.sm };
const field = {
  fontFamily: fonts.regular,
  fontSize: 17,
  minHeight: control.minHeight,
  backgroundColor: colors.surfaceSunken,
  borderRadius: radius.lg,
  paddingHorizontal: spacing.lg,
  paddingVertical: 14,
  color: colors.textPrimary,
  textAlign: 'right' as const,
  borderWidth: 1.5,
};

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const change = useChangePassword();

  // Forced first-login setup (?forced=1): a teacher must set their own password
  // before entering the app; on success we clear the local flag and go home.
  const { forced } = useLocalSearchParams<{ forced?: string }>();
  const isForced = forced === '1';
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const setSession = useAuthStore((s) => s.setSession);

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = current.length > 0 && next.length >= 6 && next === confirm && !change.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    change.mutate(
      { current_password: current, password: next },
      {
        onSuccess: () => {
          if (isForced && user && role) {
            setSession({ ...user, must_set_password: false }, role);
            router.replace('/(teacher)' as Href);
          } else {
            router.back();
          }
        },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.md, paddingHorizontal: layout.screenPadding, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {!isForced && (
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ transform: [{ scaleX: -1 }] }}><Icon name="back" size={20} color={colors.ink} /></View>
          </TouchableOpacity>
        )}
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>{isForced ? t('onboarding.set_password_title') : t('auth.change_password')}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadows.sm }}>
            {isForced && (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.lg }}>
                {t('onboarding.set_password_hint')}
              </Text>
            )}
            {change.isError && (
              <View style={{ backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.danger }}>
                <Icon name="warning" size={18} color={colors.danger} style={{ marginEnd: spacing.sm }} />
                <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.dangerText, flex: 1 }}>
                  {getFriendlyErrorMessage(change.error)}
                </Text>
              </View>
            )}

            <Text style={label}>{t('auth.current_password')}</Text>
            <TextInput
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textTertiary}
              style={{ ...field, marginBottom: spacing.lg, borderColor: current ? colors.brand : colors.borderStrong }}
            />

            <Text style={label}>{t('auth.new_password')}</Text>
            <TextInput
              value={next}
              onChangeText={setNext}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textTertiary}
              style={{ ...field, marginBottom: spacing.xs, borderColor: next ? colors.brand : colors.borderStrong }}
            />
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.lg }}>
              {t('setup.password_hint')}
            </Text>

            <Text style={label}>{t('auth.confirm_password')}</Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textTertiary}
              style={{ ...field, marginBottom: mismatch ? spacing.xs : spacing.xxl, borderColor: confirm ? (mismatch ? colors.danger : colors.success) : colors.borderStrong }}
            />
            {mismatch && (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.danger, marginBottom: spacing.xxl }}>
                {t('auth.password_mismatch')}
              </Text>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
              style={{ borderRadius: radius.lg, overflow: 'hidden', opacity: canSubmit ? 1 : 0.5 }}
            >
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ minHeight: control.minHeight, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}
              >
                {change.isPending ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse, letterSpacing: 1 }}>
                    {t('auth.change_password_button')}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
