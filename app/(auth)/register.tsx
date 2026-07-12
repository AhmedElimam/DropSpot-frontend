import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients, control } from '@/theme/index';
import { useRegister } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { getFriendlyErrorMessage } from '@/utils/errors';

const RELATIONS = ['father', 'mother', 'guardian', 'other'] as const;

// Shared Sanad text-field style (matches the login screen).
const fieldBase = {
  fontFamily: fonts.regular,
  fontSize: 17,
  minHeight: control.minHeight,
  backgroundColor: colors.surfaceSunken,
  borderRadius: radius.lg,
  paddingHorizontal: spacing.lg,
  paddingVertical: 14,
  marginBottom: spacing.lg,
  color: colors.textPrimary,
  textAlign: 'right' as const,
  borderWidth: 1.5,
};
const labelStyle = { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginBottom: spacing.sm };

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
          const pPhone = data?.data?.parent_phone;
          router.replace(`/(auth)/verify-otp?parent_phone=${encodeURIComponent(pPhone)}&student_id=${studentId}`);
        },
      },
    );
  };

  const isValid = name && phone && password && password === confirmPassword && parentName && parentPhone && parentRelation;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl, paddingVertical: spacing.xl5 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
            <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg, ...shadows.md }}>
              <Icon name="teacher" size={40} color={colors.textInverse} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.textPrimary, textAlign: 'center' }}>
              {t('auth.register_title')}
            </Text>
          </View>

          {/* Form card */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.xxl, borderWidth: 1, borderColor: colors.border, ...shadows.md }}>
            {registerMutation.isError && (
              <View style={{ backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.danger }}>
                <Icon name="warning" size={18} color={colors.danger} style={{ marginEnd: spacing.sm }} />
                <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.dangerText, flex: 1 }}>
                  {getFriendlyErrorMessage(registerMutation.error)}
                </Text>
              </View>
            )}

            {registerMutation.isSuccess && (
              <View style={{ backgroundColor: colors.successLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.success }}>
                <Icon name="success" size={18} color={colors.success} style={{ marginEnd: spacing.sm }} />
                <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.successText, flex: 1 }}>
                  {t('auth.registration_success')}
                </Text>
              </View>
            )}

            {/* Student name */}
            <Text style={labelStyle}>{t('auth.name')}</Text>
            <TextInput
              value={name} onChangeText={setName} autoCapitalize="words" autoCorrect={false}
              placeholder="محمد أحمد" placeholderTextColor={colors.textTertiary}
              style={{ ...fieldBase, borderColor: name ? colors.brand : colors.borderStrong }}
            />

            {/* Student phone */}
            <Text style={labelStyle}>{t('auth.student_phone')}</Text>
            <TextInput
              value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" autoCorrect={false}
              placeholder="01000000000" placeholderTextColor={colors.textTertiary}
              style={{ ...fieldBase, borderColor: phone ? colors.brand : colors.borderStrong }}
            />

            {/* Password */}
            <Text style={labelStyle}>{t('auth.password')}</Text>
            <TextInput
              value={password} onChangeText={setPassword} secureTextEntry
              placeholder="••••••••" placeholderTextColor={colors.textTertiary}
              style={{ ...fieldBase, borderColor: password ? colors.brand : colors.borderStrong }}
            />

            {/* Confirm password */}
            <Text style={labelStyle}>{t('auth.confirm_password')}</Text>
            <TextInput
              value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry
              placeholder="••••••••" placeholderTextColor={colors.textTertiary}
              style={{
                ...fieldBase,
                marginBottom: confirmPassword && password !== confirmPassword ? spacing.xs : spacing.lg,
                borderColor: confirmPassword ? (confirmPassword === password ? colors.success : colors.danger) : colors.borderStrong,
              }}
            />
            {confirmPassword && password !== confirmPassword ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.danger, marginBottom: spacing.lg, textAlign: 'right' }}>
                {t('auth.password_mismatch')}
              </Text>
            ) : null}

            {/* Parent name */}
            <Text style={labelStyle}>{t('auth.parent_name')}</Text>
            <TextInput
              value={parentName} onChangeText={setParentName} autoCapitalize="words" autoCorrect={false}
              placeholder="أحمد محمد" placeholderTextColor={colors.textTertiary}
              style={{ ...fieldBase, borderColor: parentName ? colors.brand : colors.borderStrong }}
            />

            {/* Parent phone */}
            <Text style={labelStyle}>{t('auth.parent_phone')}</Text>
            <TextInput
              value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" autoCapitalize="none" autoCorrect={false}
              placeholder="01000000000" placeholderTextColor={colors.textTertiary}
              style={{ ...fieldBase, borderColor: parentPhone ? colors.brand : colors.borderStrong }}
            />

            {/* Parent relation */}
            <Text style={labelStyle}>{t('auth.parent_relation')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xxl }}>
              {RELATIONS.map((rel) => {
                const on = parentRelation === rel;
                return (
                  <TouchableOpacity
                    key={rel}
                    onPress={() => setParentRelation(rel)}
                    activeOpacity={0.75}
                    style={{
                      minHeight: 48, justifyContent: 'center',
                      paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md,
                      backgroundColor: on ? colors.brandTint : colors.surfaceSunken,
                      borderWidth: 1.5, borderColor: on ? colors.brand : colors.borderStrong,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: on ? colors.brand : colors.textSecondary }}>
                      {t(`auth.${rel}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Submit */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={!isValid || registerMutation.isPending}
              activeOpacity={0.85}
              style={{ borderRadius: radius.lg, overflow: 'hidden', opacity: !isValid ? 0.5 : 1 }}
            >
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ minHeight: control.minHeight, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}
              >
                {registerMutation.isPending ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse, letterSpacing: 1 }}>
                    {t('auth.register_button')}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Back to login */}
          <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary }}>
              {t('auth.have_account')}
            </Text>
            <TouchableOpacity style={{ marginTop: spacing.sm }} onPress={() => router.push('/(auth)/login')}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.brand }}>
                {t('auth.back_to_login')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
