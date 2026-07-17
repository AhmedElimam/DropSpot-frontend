import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { isAxiosError } from 'axios';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients, control } from '@/theme/index';
import { useLogin } from '@/hooks/useAuth';
import { router } from 'expo-router';
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

export default function LoginScreen() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const loginMutation = useLogin();

  const handleLogin = () => {
    if (!phone || !password) return;
    loginMutation.mutate({ phone_number: phone, password });
  };

  return (
    <AuthScaffold
      icon="book"
      title={t('common.app_name')}
      subtitle={t('common.tagline')}
      footer={
        <>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary }}>
            {t('auth.no_account')}
          </Text>
          <TouchableOpacity style={{ marginTop: spacing.sm, minHeight: 44, justifyContent: 'center' }} onPress={() => router.push('/(auth)/register')}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.brand }}>{t('auth.register')}</Text>
          </TouchableOpacity>
        </>
      }
    >
      {loginMutation.isError && (
        <View style={{ backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.danger }}>
          <Icon name="warning" size={18} color={colors.danger} style={{ marginEnd: spacing.sm }} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.dangerText, flex: 1 }}>
            {isAxiosError(loginMutation.error) && loginMutation.error.response?.status === 401
              ? t('auth.invalid_credentials')
              : getFriendlyErrorMessage(loginMutation.error)}
          </Text>
        </View>
      )}

      <Text style={label}>{t('auth.phone')}</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="01000000000"
        placeholderTextColor={colors.textTertiary}
        style={{ ...field, marginBottom: spacing.lg, borderColor: phone ? colors.brand : colors.borderStrong }}
      />

      <Text style={label}>{t('auth.password')}</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor={colors.textTertiary}
        style={{ ...field, marginBottom: spacing.xxl, borderColor: password ? colors.brand : colors.borderStrong }}
      />

      <TouchableOpacity
        onPress={handleLogin}
        disabled={!phone || !password || loginMutation.isPending}
        activeOpacity={0.85}
        style={{ borderRadius: radius.lg, overflow: 'hidden', opacity: !phone || !password ? 0.5 : 1 }}
      >
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ minHeight: control.minHeight, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse, letterSpacing: 1 }}>
            {loginMutation.isPending ? t('auth.logging_in') : t('auth.login_button')}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </AuthScaffold>
  );
}
