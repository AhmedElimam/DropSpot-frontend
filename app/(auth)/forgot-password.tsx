import { useState } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { useForgotPassword } from '@/hooks/useAuth';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { isEgyptPhone } from '@/utils/validators';
import { Button } from '@/components/ui/Button';
import { AuthScaffold, AuthBanner } from '@/components/auth/AuthScaffold';
import { AuthField } from '@/components/auth/AuthField';

const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 11);

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);
  const forgot = useForgotPassword();

  const phoneFull = isEgyptPhone(phone) && phone.length === 11;
  const phoneError = phone && (touched || phone.length === 11) && !phoneFull ? t('auth.phone_invalid') : null;

  const handleSend = () => {
    if (!phoneFull) return;
    forgot.mutate(phone, {
      // Always advance to the reset step — the backend never reveals whether the
      // number exists, so the UX is the same either way.
      onSuccess: () => router.push({ pathname: '/(auth)/reset-password', params: { phone } }),
    });
  };

  const steps = [t('auth.forgot_step_1'), t('auth.forgot_step_2'), t('auth.forgot_step_3')];

  return (
    <AuthScaffold
      onBack={() => router.back()}
      title={t('auth.reset_password_title')}
      subtitle={t('auth.forgot_password_desc')}
    >
      {forgot.isError ? <AuthBanner tone="danger" text={getFriendlyErrorMessage(forgot.error)} /> : null}

      {/* What is about to happen, in three lines — the number is a parent's, often. */}
      <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.xl, gap: spacing.sm }}>
        {steps.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{(i + 1).toLocaleString('ar-EG')}</Text>
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary, textAlign: 'right' }}>{s}</Text>
          </View>
        ))}
      </View>

      <AuthField
        label={t('auth.phone')}
        icon="call"
        value={phone}
        onChangeText={(v) => setPhone(digits(v))}
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
        autoFocus
        containerStyle={{ marginBottom: spacing.xl }}
      />

      <Button title={t('auth.send_reset_code')} onPress={handleSend} disabled={!phoneFull} loading={forgot.isPending} />
    </AuthScaffold>
  );
}
