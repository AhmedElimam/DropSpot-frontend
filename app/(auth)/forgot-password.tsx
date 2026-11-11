import { useState } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { useMutation } from '@tanstack/react-query';
import { useForgotPassword } from '@/hooks/useAuth';
import { signupCheck } from '@/api/auth';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { isEgyptPhone } from '@/utils/validators';
import { Button } from '@/components/ui/Button';
import { AuthScaffold, AuthBanner } from '@/components/auth/AuthScaffold';
import { AuthField } from '@/components/auth/AuthField';

const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 11);

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  // mode=activate: the same code + new password, worded for a student the teacher recorded
  // who never had a password («تفعيل الحساب», not «نسيت كلمة المرور»).
  const params = useLocalSearchParams<{ phone?: string; mode?: string }>();
  const activating = params.mode === 'activate';
  const [phone, setPhone] = useState(digits(params.phone ?? ''));
  const [touched, setTouched] = useState(false);
  const forgot = useForgotPassword();
  // Activation asks the server what the number is first: a teacher's record (student or parent)
  // gets the code and «المدرّس سجّلك بالفعل»; a number with a password is told to sign in; an
  // unknown one is offered sign-up.
  const check = useMutation({ mutationFn: signupCheck });
  const answer = check.data && check.data.phone_number === phone ? check.data.status : null;

  const phoneFull = isEgyptPhone(phone) && phone.length === 11;
  const phoneError = phone && (touched || phone.length === 11) && !phoneFull ? t('auth.phone_invalid') : null;

  const handleSend = () => {
    if (!phoneFull) return;
    if (activating) {
      check.mutate(phone, {
        onSuccess: (res) => {
          if (res.status === 'activate') {
            router.push({ pathname: '/(auth)/reset-password', params: { phone: res.phone_number, mode: 'activate', by: res.role === 'parent' ? 'parent' : 'student', sent: res.code_sent === false ? '0' : '1' } });
          }
        },
      });
      return;
    }
    forgot.mutate(phone, {
      // Always advance to the reset step — the backend never reveals whether the
      // number exists, so the UX is the same either way.
      onSuccess: () => router.push({ pathname: '/(auth)/reset-password', params: activating ? { phone, mode: 'activate' } : { phone } }),
    });
  };

  const steps = [activating ? t('auth.activate_step_1') : t('auth.forgot_step_1'), t('auth.forgot_step_2'), t('auth.forgot_step_3')];

  return (
    <AuthScaffold
      onBack={() => router.back()}
      title={activating ? t('auth.activate_title') : t('auth.reset_password_title')}
      subtitle={activating ? t('auth.activate_desc') : t('auth.forgot_password_desc')}
    >
      {forgot.isError ? <AuthBanner tone="danger" text={getFriendlyErrorMessage(forgot.error)} /> : null}
      {check.isError ? <AuthBanner tone="danger" text={getFriendlyErrorMessage(check.error)} /> : null}

      {/* What is about to happen, in three lines — the number is a parent's, often. */}
      <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.xl, gap: spacing.sm }}>
        {steps.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{(i + 1).toLocaleString('ar-EG')}</Text>
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary }}>{s}</Text>
          </View>
        ))}
      </View>

      <AuthField
        label={t('auth.phone')}
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
        returnKeyType="send"
        onSubmitEditing={handleSend}
        error={phoneError}
        valid={phoneFull}
        autoFocus={!phone}
        containerStyle={{ marginBottom: spacing.xl }}
      />

      {answer === 'login' ? (
        <View style={{ backgroundColor: colors.brandTint, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: colors.infoText }}>{t('auth.signup_has_account')}</Text>
          <Button title={t('auth.login')} onPress={() => router.dismissTo({ pathname: '/(auth)/login', params: { phone } })} />
          <Button title={t('auth.forgot_password')} variant="outline" onPress={() => router.replace({ pathname: '/(auth)/forgot-password', params: { phone } })} />
        </View>
      ) : answer === 'new' ? (
        <View style={{ backgroundColor: colors.brandTint, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: colors.infoText }}>{t('auth.activate_no_account')}</Text>
          <Button title={t('auth.create_account')} onPress={() => router.replace({ pathname: '/(auth)/register', params: { phone } })} />
        </View>
      ) : (
        <Button title={activating ? t('auth.signup_continue') : t('auth.send_reset_code')} onPress={handleSend} disabled={!phoneFull} loading={forgot.isPending || check.isPending} />
      )}
    </AuthScaffold>
  );
}
