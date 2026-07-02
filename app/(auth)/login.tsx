import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions, StatusBar } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients } from '@/theme/index';
import { useLogin } from '@/hooks/useAuth';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

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
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#1E1B4B', '#312E81', '#4338CA', '#6366F1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <View style={{ position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(99,102,241,0.12)' }} />
        <View style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(139,92,246,0.08)' }} />
        <View style={{ position: 'absolute', top: height * 0.25, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(6,182,212,0.05)' }} />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl }}>
            {/* Brand header */}
            <View style={{ alignItems: 'center', marginBottom: spacing.xl5 }}>
              <View style={{ width: 88, height: 88, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.07)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: spacing.xl }}>
                <Text style={{ fontSize: 40 }}>{'📚'}</Text>
              </View>

              {/* DrosSpot badge — in RTL, children render right-to-left, so "Spot" first then "Dros" = "Dros Spot" visually */}
              <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.xl, paddingVertical: spacing.lg, paddingHorizontal: spacing.xxl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 40, color: '#fff', letterSpacing: 2, textAlign: 'center' }}>
                  <Text style={{ color: '#A5B4FC' }}>SPOT</Text>
                  <Text style={{ color: '#fff' }}>DROS</Text>
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm }}>
                <View style={{ width: 24, height: 1, backgroundColor: 'rgba(165,180,252,0.25)' }} />
                <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 4 }}>
                  {t('common.tagline').toUpperCase()}
                </Text>
                <View style={{ width: 24, height: 1, backgroundColor: 'rgba(165,180,252,0.25)' }} />
              </View>
            </View>

            {/* Form card */}
            <View style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.xxl, padding: spacing.xxl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              {loginMutation.isError && (
                <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)' }}>
                  <Text style={{ fontSize: 14, marginEnd: spacing.sm }}>{'⚠️'}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: '#FCA5A5', flex: 1 }}>
                    {(loginMutation.error as any)?.response?.data?.message || (loginMutation.error as any)?.message || t('auth.invalid_credentials')}
                  </Text>
                </View>
              )}

              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: spacing.sm }}>{t('auth.phone')}</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="01000000000"
                placeholderTextColor="rgba(255,255,255,0.25)"
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 16,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: radius.md,
                  padding: 16,
                  marginBottom: spacing.lg,
                  color: '#fff',
                  textAlign: 'right',
                  borderWidth: 1.5,
                  borderColor: phone ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
                }}
              />

              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: spacing.sm }}>{t('auth.password')}</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.25)"
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 16,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: radius.md,
                  padding: 16,
                  marginBottom: spacing.xxl,
                  color: '#fff',
                  textAlign: 'right',
                  borderWidth: 1.5,
                  borderColor: password ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
                }}
              />

              <TouchableOpacity
                onPress={handleLogin}
                disabled={!phone || !password || loginMutation.isPending}
                activeOpacity={0.85}
                style={{ borderRadius: radius.md, overflow: 'hidden', opacity: !phone || !password ? 0.5 : 1 }}
              >
                <LinearGradient
                  colors={gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }}
                >
                  {loginMutation.isPending ? (
                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }}>{t('auth.logging_in')}</Text>
                  ) : (
                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff', letterSpacing: 1 }}>{t('auth.login_button')}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                {t('auth.no_account')}
              </Text>
              <TouchableOpacity style={{ marginTop: spacing.sm }} onPress={() => router.push('/(auth)/register')}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'rgba(165,180,252,0.8)' }}>
                  {t('auth.register')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}
