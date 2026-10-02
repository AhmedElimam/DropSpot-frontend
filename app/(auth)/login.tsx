import { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { useLogin } from '@/hooks/useAuth';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { isEgyptPhone } from '@/utils/validators';
import { Button } from '@/components/ui/Button';
import { AuthScaffold, AuthBanner } from '@/components/auth/AuthScaffold';
import { AuthField } from '@/components/auth/AuthField';

const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 11);

export default function LoginScreen() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);
  const loginMutation = useLogin();

  // A full Egyptian number is 11 digits; say so only once the user has typed that many
  // (or left the field) — never while they are still typing.
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneFull = isEgyptPhone(phone) && phone.length === 11;
  const phoneError = phone && (phoneTouched || phone.length === 11) && !phoneFull ? t('auth.phone_invalid') : null;
  const canSubmit = phoneFull && password.length > 0 && !loginMutation.isPending;

  const handleLogin = () => {
    if (!canSubmit) return;
    loginMutation.mutate({ phone_number: phone, password });
  };

  return (
    <AuthScaffold
      hero="brand"
      eyebrow={t('auth.welcome_back')}
      title={t('auth.login')}
      subtitle={t('auth.login_subtitle')}
      footer={
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textTertiary, textAlign: 'center' }}>
          {t('common.tagline')}
        </Text>
      }
    >
      {loginMutation.isError ? (
        <AuthBanner
          tone="danger"
          text={isAxiosError(loginMutation.error) && loginMutation.error.response?.status === 401
            ? t('auth.invalid_credentials')
            : getFriendlyErrorMessage(loginMutation.error)}
        />
      ) : null}

      <AuthField
        label={t('auth.phone')}
        icon="call"
        value={phone}
        onChangeText={(v) => setPhone(digits(v))}
        onBlur={() => setPhoneTouched(true)}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        autoCorrect={false}
        maxLength={11}
        placeholder="01xxxxxxxxx"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        blurOnSubmit={false}
        error={phoneError}
        valid={phoneFull}
      />

      <AuthField
        ref={passwordRef}
        secure
        label={t('auth.password')}
        icon="lock"
        value={password}
        onChangeText={setPassword}
        autoComplete="password"
        textContentType="password"
        placeholder="••••••••"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
        containerStyle={{ marginBottom: spacing.sm }}
      />

      <TouchableOpacity
        onPress={() => router.push('/(auth)/forgot-password')}
        hitSlop={{ top: 8, bottom: 8 }}
        style={{ alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', marginBottom: spacing.lg }}
      >
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.brand }}>{t('auth.forgot_password')}</Text>
      </TouchableOpacity>

      <Button title={t('auth.login_button')} onPress={handleLogin} disabled={!canSubmit} loading={loginMutation.isPending} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.borderLight }} />
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary }}>{t('auth.no_account')}</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.borderLight }} />
      </View>

      <Button title={t('auth.create_account')} variant="outline" onPress={() => router.push('/(auth)/register')} />
    </AuthScaffold>
  );
}
