import { useState, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { getFriendlyErrorMessage } from '@/utils/errors';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients, control } from '@/theme/index';
import { verifyOtp } from '@/api/auth';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

export default function VerifyOtpScreen() {
  const { t } = useTranslation();
  const { parent_phone } = useLocalSearchParams<{
    parent_phone: string;
    student_id: string;
  }>();
  const [code, setCode] = useState('');
  const inputRef = useRef<TextInput>(null);

  const verifyMutation = useMutation({
    mutationFn: () => verifyOtp(parent_phone ?? '', code),
    onSuccess: () => {
      router.replace('/(auth)/login');
    },
  });

  const handleVerify = () => {
    if (code.length !== 6) return;
    verifyMutation.mutate();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl }}>
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: spacing.xl5 }}>
            <View style={{ width: 88, height: 88, borderRadius: 26, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl, ...shadows.md }}>
              <Icon name="phone" size={44} color={colors.textInverse} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary, textAlign: 'center' }}>
              {t('auth.verify_otp_title')}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
              {t('auth.verify_otp_desc')}
            </Text>
            {parent_phone ? (
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.brand, textAlign: 'center', marginTop: spacing.xs }}>
                {parent_phone}
              </Text>
            ) : null}
          </View>

          {/* Form card */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.xxl, borderWidth: 1, borderColor: colors.border, ...shadows.md }}>
            {verifyMutation.isError && (
              <View style={{ backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.danger }}>
                <Icon name="warning" size={18} color={colors.danger} style={{ marginEnd: spacing.sm }} />
                <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.dangerText, flex: 1 }}>
                  {getFriendlyErrorMessage(verifyMutation.error)}
                </Text>
              </View>
            )}

            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginBottom: spacing.sm, textAlign: 'center' }}>
              {t('auth.otp_code')}
            </Text>
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              placeholderTextColor={colors.textTertiary}
              style={{
                fontFamily: fonts.bold,
                fontSize: 32,
                minHeight: control.minHeight,
                backgroundColor: colors.surfaceSunken,
                borderRadius: radius.lg,
                padding: 16,
                marginBottom: spacing.xxl,
                color: colors.textPrimary,
                textAlign: 'center',
                letterSpacing: 12,
                borderWidth: 1.5,
                borderColor: code.length === 6 ? colors.brand : colors.borderStrong,
              }}
            />

            <TouchableOpacity
              onPress={handleVerify}
              disabled={code.length !== 6 || verifyMutation.isPending}
              activeOpacity={0.85}
              style={{ borderRadius: radius.lg, overflow: 'hidden', opacity: code.length !== 6 ? 0.5 : 1 }}
            >
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ minHeight: control.minHeight, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }}
              >
                {verifyMutation.isPending ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse, letterSpacing: 1 }}>
                    {t('auth.verify_button')}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Back to login */}
          <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.brand }}>
                {t('auth.back_to_login')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
