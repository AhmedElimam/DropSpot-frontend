import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients, control } from '@/theme/index';
import { useForgotPassword } from '@/hooks/useAuth';
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

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');

  const forgot = useForgotPassword();

  const handleSend = () => {
    if (!phone) return;
    forgot.mutate(phone, {
      // Always advance to the reset step — the backend never reveals whether the
      // number exists, so the UX is the same either way.
      onSuccess: () => router.push({ pathname: '/(auth)/reset-password', params: { phone } }),
    });
  };

  return (
    <AuthScaffold
      icon="lock"
      title={t('auth.reset_password_title')}
      subtitle={t('auth.forgot_password_desc')}
      footer={
        <TouchableOpacity style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => router.push('/(auth)/login')}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.brand }}>{t('auth.back_to_login')}</Text>
        </TouchableOpacity>
      }
    >
      {forgot.isError && (
        <View style={{ backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.danger }}>
          <Icon name="warning" size={18} color={colors.danger} style={{ marginEnd: spacing.sm }} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.dangerText, flex: 1 }}>
            {getFriendlyErrorMessage(forgot.error)}
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
        style={{ ...field, marginBottom: spacing.xxl, borderColor: phone ? colors.brand : colors.borderStrong }}
      />

      <TouchableOpacity
        onPress={handleSend}
        disabled={!phone || forgot.isPending}
        activeOpacity={0.85}
        style={{ borderRadius: radius.lg, overflow: 'hidden', opacity: !phone ? 0.5 : 1 }}
      >
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ minHeight: control.minHeight, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}
        >
          {forgot.isPending ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse, letterSpacing: 1 }}>
              {t('auth.send_reset_code')}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </AuthScaffold>
  );
}
