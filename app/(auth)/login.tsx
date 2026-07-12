import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { isAxiosError } from 'axios';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients, control } from '@/theme/index';
import { useLogin } from '@/hooks/useAuth';
import { router } from 'expo-router';

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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl }}>
          {/* Brand header */}
          <View style={{ alignItems: 'center', marginBottom: spacing.xl5 }}>
            <View style={{ width: 88, height: 88, borderRadius: 26, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl, ...shadows.md }}>
              <Icon name="book" size={44} color={colors.textInverse} />
            </View>

            {/* DrosSpot badge — in RTL, children render right-to-left, so "Spot" first then "Dros" = "Dros Spot" visually */}
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 40, letterSpacing: 2, textAlign: 'center' }}>
                <Text style={{ color: colors.brand }}>SPOT</Text>
                <Text style={{ color: colors.textPrimary }}>DROS</Text>
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm }}>
              <View style={{ width: 24, height: 1, backgroundColor: colors.borderStrong }} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary, letterSpacing: 4 }}>
                {t('common.tagline').toUpperCase()}
              </Text>
              <View style={{ width: 24, height: 1, backgroundColor: colors.borderStrong }} />
            </View>
          </View>

          {/* Form card */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.xxl, borderWidth: 1, borderColor: colors.border, ...shadows.md }}>
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

            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('auth.phone')}</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="01000000000"
              placeholderTextColor={colors.textTertiary}
              style={{
                fontFamily: fonts.regular,
                fontSize: 17,
                minHeight: control.minHeight,
                backgroundColor: colors.surfaceSunken,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: 14,
                marginBottom: spacing.lg,
                color: colors.textPrimary,
                textAlign: 'right',
                borderWidth: 1.5,
                borderColor: phone ? colors.brand : colors.borderStrong,
              }}
            />

            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('auth.password')}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textTertiary}
              style={{
                fontFamily: fonts.regular,
                fontSize: 17,
                minHeight: control.minHeight,
                backgroundColor: colors.surfaceSunken,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: 14,
                marginBottom: spacing.xxl,
                color: colors.textPrimary,
                textAlign: 'right',
                borderWidth: 1.5,
                borderColor: password ? colors.brand : colors.borderStrong,
              }}
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
                {loginMutation.isPending ? (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse }}>{t('auth.logging_in')}</Text>
                ) : (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse, letterSpacing: 1 }}>{t('auth.login_button')}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary }}>
              {t('auth.no_account')}
            </Text>
            <TouchableOpacity style={{ marginTop: spacing.sm }} onPress={() => router.push('/(auth)/register')}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.brand }}>
                {t('auth.register')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
