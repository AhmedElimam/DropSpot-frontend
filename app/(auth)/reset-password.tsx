import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients, control } from '@/theme/index';
import { useResetPassword, useForgotPassword } from '@/hooks/useAuth';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { Icon } from '@/components/ui/Icon';
import { AuthScaffold } from '@/components/auth/AuthScaffold';

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

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  const reset = useResetPassword();
  const resend = useForgotPassword();

  const canSubmit = code.length === 6 && password.length >= 6;

  const handleReset = () => {
    if (!canSubmit || !phone) return;
    reset.mutate(
      { phone_number: phone, code, password },
      // Logged in on success → hand off to app/index.tsx which routes by role.
      { onSuccess: () => router.replace('/') },
    );
  };

  return (
    <AuthScaffold
      icon="lock"
      title={t('auth.reset_password_title')}
      subtitle={phone ? `${t('auth.reset_desc')}\n${phone}` : t('auth.reset_desc')}
      footer={
        <TouchableOpacity style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => router.replace('/(auth)/login')}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.brand }}>{t('auth.back_to_login')}</Text>
        </TouchableOpacity>
      }
    >
      {reset.isError && (
        <View style={{ backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.danger }}>
          <Icon name="warning" size={18} color={colors.danger} style={{ marginEnd: spacing.sm }} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.dangerText, flex: 1 }}>
            {getFriendlyErrorMessage(reset.error)}
          </Text>
        </View>
      )}

      <Text style={label}>{t('auth.otp_code')}</Text>
      <TextInput
        value={code}
        onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="123456"
        placeholderTextColor={colors.textTertiary}
        style={{ ...field, marginBottom: spacing.lg, textAlign: 'center', fontFamily: fonts.bold, fontSize: 26, letterSpacing: 10, borderColor: code.length === 6 ? colors.brand : colors.borderStrong }}
      />

      <Text style={label}>{t('auth.new_password')}</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor={colors.textTertiary}
        style={{ ...field, marginBottom: spacing.xs, borderColor: password ? colors.brand : colors.borderStrong }}
      />
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.xxl }}>
        {t('setup.password_hint')}
      </Text>

      <TouchableOpacity
        onPress={handleReset}
        disabled={!canSubmit || reset.isPending}
        activeOpacity={0.85}
        style={{ borderRadius: radius.lg, overflow: 'hidden', opacity: canSubmit ? 1 : 0.5 }}
      >
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ minHeight: control.minHeight, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}
        >
          {reset.isPending ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse, letterSpacing: 1 }}>
              {t('auth.reset_button')}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: spacing.md }}
        disabled={resend.isPending || !phone}
        onPress={() => phone && resend.mutate(phone)}
      >
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.brand }}>
          {resend.isSuccess ? t('auth.reset_code_sent') : t('auth.resend_code')}
        </Text>
      </TouchableOpacity>
    </AuthScaffold>
  );
}
