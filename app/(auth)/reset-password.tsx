import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { useResetPassword, useForgotPassword } from '@/hooks/useAuth';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { Button } from '@/components/ui/Button';
import { AuthScaffold, AuthBanner } from '@/components/auth/AuthScaffold';
import { AuthField } from '@/components/auth/AuthField';
import { OtpInput } from '@/components/auth/OtpInput';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { ROUTE_BY_ROLE } from '@/utils/routes';

const RESEND_COOLDOWN = 60;

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);

  const reset = useResetPassword();
  const resend = useForgotPassword();

  // The code was just sent (we arrived from the previous screen) → the countdown runs.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const canSubmit = code.length === 6 && password.length >= 6 && !reset.isPending;

  const handleReset = () => {
    if (!canSubmit || !phone) return;
    reset.mutate(
      { phone_number: phone, code, password },
      // Logged in on success → hand off to app/index.tsx which routes by role.
      { onSuccess: () => router.replace(ROUTE_BY_ROLE) },
    );
  };

  const handleResend = () => {
    if (cooldown > 0 || resend.isPending || !phone) return;
    resend.mutate(phone, { onSuccess: () => { setCooldown(RESEND_COOLDOWN); setCode(''); reset.reset(); } });
  };

  return (
    <AuthScaffold
      onBack={() => router.back()}
      title={t('auth.reset_password_title')}
      subtitle={t('auth.code_sent_to')}
    >
      {phone ? (
        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brandTint, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: spacing.md, marginBottom: spacing.xl }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand }}>{phone}</Text>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand, textDecorationLine: 'underline' }}>{t('auth.confirm_phone_edit')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {reset.isError ? <AuthBanner tone="danger" text={getFriendlyErrorMessage(reset.error)} /> : null}
      {resend.isSuccess && cooldown > RESEND_COOLDOWN - 5 ? <AuthBanner tone="success" text={t('auth.reset_code_sent')} /> : null}

      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('auth.otp_code')}</Text>
      <OtpInput value={code} onChange={(v) => { setCode(v); if (reset.isError) reset.reset(); }} onComplete={() => passwordRef.current?.focus()} error={reset.isError} />

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, marginBottom: spacing.xl, flexWrap: 'wrap' }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{t('auth.didnt_receive')}</Text>
        <TouchableOpacity onPress={handleResend} disabled={cooldown > 0 || resend.isPending} hitSlop={{ top: 8, bottom: 8 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: cooldown > 0 ? colors.textTertiary : colors.brand }}>
            {resend.isPending ? t('common.loading') : cooldown > 0 ? t('auth.resend_in', { seconds: cooldown }) : t('auth.resend_code')}
          </Text>
        </TouchableOpacity>
      </View>

      <AuthField
        ref={passwordRef}
        secure
        label={t('auth.new_password')}
        icon="lock"
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="••••••••"
        hint={password ? undefined : t('setup.password_hint')}
        returnKeyType="go"
        onSubmitEditing={handleReset}
      />
      <PasswordStrength password={password} />

      <Button title={t('auth.reset_button')} onPress={handleReset} disabled={!canSubmit} loading={reset.isPending} />
    </AuthScaffold>
  );
}
