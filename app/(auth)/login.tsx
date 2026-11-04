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
import { AuthScaffold, AuthBanner, AUTH_FOOTER_TEXT } from '@/components/auth/AuthScaffold';
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

  // The teacher recorded this student and they never chose a password (founder 2026-11-04:
  // they were making a second account instead). Activation is the reset flow, number filled.
  const mayNeedActivation = isAxiosError(loginMutation.error) && loginMutation.error.response?.data?.errors?.may_need_activation === true;
  const activate = (prefill?: string) => router.push({ pathname: '/(auth)/forgot-password', params: { mode: 'activate', ...(prefill ? { phone: prefill } : {}) } });

  return (
    <AuthScaffold
      hero="brand"
      eyebrow={t('auth.welcome_back')}
      title={t('auth.login')}
      subtitle={t('auth.login_subtitle')}
      footer={
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: AUTH_FOOTER_TEXT, textAlign: 'center' }}>
          {t('common.tagline')}
        </Text>
      }
    >
      {loginMutation.isError ? (
        <AuthBanner
          tone="danger"
          // A wrong password now says how many tries are left (three, then a 15-minute
          // lock — founder 2026-10-04); the server's Arabic line is shown when it sends one.
          text={isAxiosError(loginMutation.error) && loginMutation.error.response?.status === 401
            ? (typeof loginMutation.error.response?.data?.message === 'string' && /[\u0600-\u06FF]/.test(loginMutation.error.response.data.message)
              ? loginMutation.error.response.data.message
              : t('auth.invalid_credentials'))
            : getFriendlyErrorMessage(loginMutation.error)}
        />
      ) : null}
      {mayNeedActivation ? (
        <View style={{ backgroundColor: colors.brandTint, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg, gap: spacing.sm }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: colors.infoText }}>{t('auth.may_need_activation')}</Text>
          <Button title={t('auth.activate_account')} onPress={() => activate(phone)} />
        </View>
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

      <TouchableOpacity onPress={() => activate()} hitSlop={{ top: 8, bottom: 8 }} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: spacing.md }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
          {t('auth.activate_prompt')} <Text style={{ fontFamily: fonts.bold, color: colors.brand }}>{t('auth.activate_account')}</Text>
        </Text>
      </TouchableOpacity>
    </AuthScaffold>
  );
}
