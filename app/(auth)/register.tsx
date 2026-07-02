import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { spacing, radius, gradients } from '@/theme/index';
import { useRegister } from '@/hooks/useAuth';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

const RELATIONS = ['father', 'mother', 'guardian', 'other'] as const;

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentRelation, setParentRelation] = useState<string>('');
  const registerMutation = useRegister();

  const handleRegister = () => {
    if (!name || !phone || !password || password !== confirmPassword || !parentName || !parentPhone || !parentRelation) return;
    registerMutation.mutate(
      {
        name,
        phone_number: phone,
        password,
        parent_name: parentName,
        parent_phone: parentPhone,
        parent_relation: parentRelation,
      },
      {
        onSuccess: (data) => {
          const studentId = data?.data?.student_id;
          const parentPhone = data?.data?.parent_phone;
          router.replace(`/(auth)/verify-otp?parent_phone=${encodeURIComponent(parentPhone)}&student_id=${studentId}`);
        },
      },
    );
  };

  const isValid = name && phone && password && password === confirmPassword && parentName && parentPhone && parentRelation;

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
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              paddingHorizontal: spacing.xxl,
              paddingVertical: spacing.xl5,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: spacing.xl5 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  backgroundColor: 'rgba(255,255,255,0.07)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  marginBottom: spacing.lg,
                }}
              >
                <Text style={{ fontSize: 36 }}>{'🎓'}</Text>
              </View>
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 26,
                  color: '#fff',
                  textAlign: 'center',
                }}
              >
                {t('auth.register_title')}
              </Text>
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
              {registerMutation.isError && (
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
                  <Text style={{ fontSize: 14, marginEnd: spacing.sm }}>{'⚠️'}</Text>
                  <Text
                    style={{
                      fontFamily: fonts.regular,
                      fontSize: 13,
                      color: '#FCA5A5',
                      flex: 1,
                    }}
                  >
                    {(registerMutation.error as any)?.response?.data?.message ||
                      (registerMutation.error as any)?.message ||
                      t('auth.invalid_credentials')}
                  </Text>
                </View>
              )}

              {registerMutation.isSuccess && (
                <View
                  style={{
                    backgroundColor: 'rgba(34,197,94,0.12)',
                    padding: spacing.md,
                    borderRadius: radius.md,
                    marginBottom: spacing.lg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(34,197,94,0.15)',
                  }}
                >
                  <Text style={{ fontSize: 14, marginEnd: spacing.sm }}>{'✅'}</Text>
                  <Text
                    style={{
                      fontFamily: fonts.regular,
                      fontSize: 13,
                      color: '#86EFAC',
                      flex: 1,
                    }}
                  >
                    {t('auth.registration_success')}
                  </Text>
                </View>
              )}

              {/* Student name */}
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: spacing.sm,
                }}
              >
                {t('auth.name')}
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                placeholder="محمد أحمد"
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
                  borderColor: name ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
                }}
              />

              {/* Student phone */}
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: spacing.sm,
                }}
              >
                {t('auth.student_phone')}
              </Text>
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

              {/* Password */}
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: spacing.sm,
                }}
              >
                {t('auth.password')}
              </Text>
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
                  marginBottom: spacing.lg,
                  color: '#fff',
                  textAlign: 'right',
                  borderWidth: 1.5,
                  borderColor: password ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
                }}
              />

              {/* Confirm password */}
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: spacing.sm,
                }}
              >
                {t('auth.confirm_password')}
              </Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="••••••••"
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
                  borderColor:
                    confirmPassword
                      ? confirmPassword === password
                        ? 'rgba(34,197,94,0.5)'
                        : 'rgba(239,68,68,0.5)'
                      : 'rgba(255,255,255,0.08)',
                }}
              />

              {confirmPassword && password !== confirmPassword && (
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 12,
                    color: '#FCA5A5',
                    marginTop: -spacing.sm,
                    marginBottom: spacing.lg,
                    textAlign: 'right',
                  }}
                >
                  {t('auth.password_mismatch')}
                </Text>
              )}

              {/* Parent name */}
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: spacing.sm,
                }}
              >
                {t('auth.parent_name')}
              </Text>
              <TextInput
                value={parentName}
                onChangeText={setParentName}
                autoCapitalize="words"
                autoCorrect={false}
                placeholder="أحمد محمد"
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
                  borderColor: parentName ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
                }}
              />

              {/* Parent phone */}
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: spacing.sm,
                }}
              >
                {t('auth.parent_phone')}
              </Text>
              <TextInput
                value={parentPhone}
                onChangeText={setParentPhone}
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
                  borderColor: parentPhone ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
                }}
              />

              {/* Parent relation */}
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: spacing.sm,
                }}
              >
                {t('auth.parent_relation')}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.sm,
                  marginBottom: spacing.xxl,
                }}
              >
                {RELATIONS.map((rel) => (
                  <TouchableOpacity
                    key={rel}
                    onPress={() => setParentRelation(rel)}
                    activeOpacity={0.7}
                    style={{
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.lg,
                      borderRadius: radius.md,
                      backgroundColor:
                        parentRelation === rel
                          ? 'rgba(99,102,241,0.3)'
                          : 'rgba(255,255,255,0.05)',
                      borderWidth: 1.5,
                      borderColor:
                        parentRelation === rel
                          ? 'rgba(99,102,241,0.5)'
                          : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.medium,
                        fontSize: 14,
                        color:
                          parentRelation === rel
                            ? 'rgba(255,255,255,0.9)'
                            : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {t(`auth.${rel}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Submit */}
              <TouchableOpacity
                onPress={handleRegister}
                disabled={!isValid || registerMutation.isPending}
                activeOpacity={0.85}
                style={{
                  borderRadius: radius.md,
                  overflow: 'hidden',
                  opacity: !isValid ? 0.5 : 1,
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
                  {registerMutation.isPending ? (
                    <Text
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 17,
                        color: '#fff',
                      }}
                    >
                      {t('auth.registering')}
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
                      {t('auth.register_button')}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Back to login */}
            <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.35)',
                }}
              >
                {t('auth.have_account')}
              </Text>
              <TouchableOpacity
                style={{ marginTop: spacing.sm }}
                onPress={() => router.push('/(auth)/login')}
              >
                <Text
                  style={{
                    fontFamily: fonts.medium,
                    fontSize: 14,
                    color: 'rgba(165,180,252,0.8)',
                  }}
                >
                  {t('auth.back_to_login')}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}
