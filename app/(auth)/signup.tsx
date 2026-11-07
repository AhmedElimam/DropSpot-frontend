import { useState } from 'react';
import { View, Text } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { signupCheck } from '@/api/auth';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { isEgyptPhone } from '@/utils/validators';
import { Button } from '@/components/ui/Button';
import { AuthScaffold, AuthBanner } from '@/components/auth/AuthScaffold';
import { AuthField } from '@/components/auth/AuthField';

const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 11);

/**
 * Sign-up starts with the phone number (founder 2026-11-07: «tons of human error where they are
 * registered already»). A new number goes on to the form, filled in; a number the teacher
 * recorded gets the activation code and «اختار كلمة المرور»; a number that already has a
 * password is told to sign in — no SMS for that one.
 */
export default function SignupScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ phone?: string }>();
  const [phone, setPhone] = useState(digits(params.phone ?? ''));
  const [touched, setTouched] = useState(false);
  const check = useMutation({ mutationFn: signupCheck });

  const phoneFull = isEgyptPhone(phone) && phone.length === 11;
  const phoneError = phone && (touched || phone.length === 11) && !phoneFull ? t('auth.phone_invalid') : null;
  const hasAccount = check.data?.status === 'login' && check.data.phone_number === phone;

  const handleContinue = () => {
    if (!phoneFull || check.isPending) return;
    check.mutate(phone, {
      onSuccess: (res) => {
        if (res.status === 'new') {
          router.push({ pathname: '/(auth)/register', params: { phone } });
        } else if (res.status === 'activate') {
          router.push({
            pathname: '/(auth)/reset-password',
            params: { phone: res.phone_number, mode: 'activate', by: res.role === 'parent' ? 'parent' : 'student', sent: res.code_sent === false ? '0' : '1' },
          });
        }
      },
    });
  };

  return (
    <AuthScaffold onBack={() => router.back()} title={t('auth.signup_title')} subtitle={t('auth.signup_subtitle')}>
      {check.isError ? <AuthBanner tone="danger" text={getFriendlyErrorMessage(check.error)} /> : null}

      <AuthField
        label={t('auth.signup_phone')}
        icon="call"
        value={phone}
        onChangeText={(v) => { setPhone(digits(v)); if (check.data || check.isError) check.reset(); }}
        onBlur={() => setTouched(true)}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        autoCorrect={false}
        maxLength={11}
        placeholder="01xxxxxxxxx"
        returnKeyType="next"
        onSubmitEditing={handleContinue}
        error={phoneError}
        valid={phoneFull}
        autoFocus={!phone}
        containerStyle={{ marginBottom: spacing.xl }}
      />

      {hasAccount ? (
        <View style={{ backgroundColor: colors.brandTint, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: colors.infoText }}>{t('auth.signup_has_account')}</Text>
          <Button title={t('auth.login')} onPress={() => router.dismissTo({ pathname: '/(auth)/login', params: { phone } })} />
          <Button title={t('auth.forgot_password')} variant="outline" onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { phone } })} />
        </View>
      ) : (
        <Button title={t('auth.signup_continue')} onPress={handleContinue} disabled={!phoneFull} loading={check.isPending} />
      )}
    </AuthScaffold>
  );
}
