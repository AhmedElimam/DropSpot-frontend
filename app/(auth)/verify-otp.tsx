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
  Dimensions,
  StatusBar,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { spacing, radius, gradients } from '@/theme/index';
import { verifyOtp } from '@/api/auth';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

const { height } = Dimensions.get('window');

export default function VerifyOtpScreen() {
  const { t } = useTranslation();
  const { parent_phone, student_id } = useLocalSearchParams<{
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
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#1E1B4B', '#312E81', '#4338CA', '#6366F1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <View
          style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 240,
            height: 240,
            borderRadius: 120,
            backgroundColor: 'rgba(99,102,241,0.12)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -60,
            left: -60,
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: 'rgba(139,92,246,0.08)',
          }}
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              paddingHorizontal: spacing.xxl,
            }}
          >
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: spacing.xl5 }}>
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 26,
                  backgroundColor: 'rgba(255,255,255,0.07)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  marginBottom: spacing.xl,
                }}
              >
                <Icon name="phone" size={44} color="#fff" />
              </View>
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 24,
                  color: '#fff',
                  textAlign: 'center',
                }}
              >
                {t('auth.verify_otp_title')}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 14,
                  color: 'rgba(255,255,255,0.5)',
                  textAlign: 'center',
                  marginTop: spacing.sm,
                }}
              >
                {t('auth.verify_otp_desc')}
              </Text>
              {parent_phone && (
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 16,
                    color: '#A5B4FC',
                    textAlign: 'center',
                    marginTop: spacing.xs,
                  }}
                >
                  {parent_phone}
                </Text>
              )}
            </View>

            {/* Form card */}
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderRadius: radius.xxl,
                padding: spacing.xxl,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              {verifyMutation.isError && (
                <View
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.12)',
                    padding: spacing.md,
                    borderRadius: radius.md,
                    marginBottom: spacing.lg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(239,68,68,0.15)',
                  }}
                >
                  <Icon name="warning" size={16} color="#FCA5A5" style={{ marginEnd: spacing.sm }} />
                  <Text
                    style={{
                      fontFamily: fonts.regular,
                      fontSize: 13,
                      color: '#FCA5A5',
                      flex: 1,
                    }}
                  >
                    {getFriendlyErrorMessage(verifyMutation.error)}
                  </Text>
                </View>
              )}

              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: spacing.sm,
                  textAlign: 'center',
                }}
              >
                {t('auth.otp_code')}
              </Text>
              <TextInput
                ref={inputRef}
                value={code}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, '').slice(0, 6);
                  setCode(digits);
                }}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
                placeholderTextColor="rgba(255,255,255,0.25)"
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 32,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: radius.md,
                  padding: 16,
                  marginBottom: spacing.xxl,
                  color: '#fff',
                  textAlign: 'center',
                  letterSpacing: 12,
                  borderWidth: 1.5,
                  borderColor: code.length === 6 ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
                }}
              />

              <TouchableOpacity
                onPress={handleVerify}
                disabled={code.length !== 6 || verifyMutation.isPending}
                activeOpacity={0.85}
                style={{
                  borderRadius: radius.md,
                  overflow: 'hidden',
                  opacity: code.length !== 6 ? 0.5 : 1,
                }}
              >
                <LinearGradient
                  colors={gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {verifyMutation.isPending ? (
                    <Text
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 17,
                        color: '#fff',
                      }}
                    >
                      {t('auth.verifying')}
                    </Text>
                  ) : (
                    <Text
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 17,
                        color: '#fff',
                        letterSpacing: 1,
                      }}
                    >
                      {t('auth.verify_button')}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Back to login */}
            <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text
                  style={{
                    fontFamily: fonts.medium,
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.55)',
                  }}
                >
                  {t('auth.back_to_login')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}
