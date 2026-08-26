import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients, control } from '@/theme/index';
import { useRegister } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { PhoneConfirmModal } from '@/components/auth/PhoneConfirmModal';
import { TermsConsentRow } from '@/components/auth/TermsConsentRow';

const RELATIONS = ['father', 'mother', 'guardian', 'other'] as const;

// Names are entered in Arabic. Flag the moment any Latin letter appears so the
// user gets instant feedback instead of a server rejection after submit.
const hasLatinLetters = (v: string) => /[A-Za-z]/.test(v);

const labelStyle = { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginBottom: spacing.sm };
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

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentRelation, setParentRelation] = useState<string>('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const registerMutation = useRegister();

  const nameHasLatin = hasLatinLetters(name);
  const parentNameHasLatin = hasLatinLetters(parentName);

  const handleRegister = () => {
    if (!name || !phone || !password || password !== confirmPassword || !parentName || !parentPhone || !parentRelation) return;
    if (nameHasLatin || parentNameHasLatin || !termsAccepted) return;
    registerMutation.mutate(
      {
        name,
        phone_number: phone,
        password,
        parent_name: parentName,
        parent_phone: parentPhone,
        parent_relation: parentRelation,
        terms_accepted: termsAccepted,
      },
      {
        onSuccess: (data) => {
          const studentId = data?.data?.student_id;
          const pPhone = data?.data?.parent_phone;
          // Parent already verified (completed setup) → the server skipped the OTP and
          // linked to them. No code to enter; go straight to the welcome screen. The
          // student's OWN number is still walled separately, so nothing is bypassed here.
          if (data?.data?.otp_required === false) {
            router.replace(`/(auth)/welcome?name=${encodeURIComponent(name)}`);
            return;
          }
          router.replace(`/(auth)/verify-otp?parent_phone=${encodeURIComponent(pPhone)}&student_id=${studentId}&name=${encodeURIComponent(name)}`);
        },
      },
    );
  };

  const isValid = name && !nameHasLatin && phone && password && password === confirmPassword && parentName && !parentNameHasLatin && parentPhone && parentRelation && termsAccepted;

  return (
    <AuthScaffold
      icon="children"
      title={t('auth.register_title')}
      subtitle={t('common.tagline')}
      footer={
        <>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary }}>
            {t('auth.have_account')}
          </Text>
          <TouchableOpacity style={{ marginTop: spacing.sm, minHeight: 44, justifyContent: 'center' }} onPress={() => router.push('/(auth)/login')}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.brand }}>{t('auth.back_to_login')}</Text>
          </TouchableOpacity>
        </>
      }
    >
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
        placeholder={t('auth.name_example')} placeholderTextColor={colors.textTertiary}
        style={{
          ...fieldBase,
          marginBottom: nameHasLatin ? spacing.xs : spacing.lg,
          borderColor: nameHasLatin ? colors.danger : name ? colors.brand : colors.borderStrong,
        }}
      />
      {nameHasLatin ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.danger, marginBottom: spacing.lg, textAlign: 'right' }}>
          {t('auth.name_arabic_only')}
        </Text>
      ) : null}

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
        placeholder={t('auth.parent_name_example')} placeholderTextColor={colors.textTertiary}
        style={{
          ...fieldBase,
          marginBottom: parentNameHasLatin ? spacing.xs : spacing.lg,
          borderColor: parentNameHasLatin ? colors.danger : parentName ? colors.brand : colors.borderStrong,
        }}
      />
      {parentNameHasLatin ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.danger, marginBottom: spacing.lg, textAlign: 'right' }}>
          {t('auth.name_arabic_only')}
        </Text>
      ) : null}

      {/* Parent phone */}
      <Text style={labelStyle}>{t('auth.parent_phone')}</Text>
      <TextInput
        value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" autoCapitalize="none" autoCorrect={false}
        placeholder="01000000000" placeholderTextColor={colors.textTertiary}
        style={{ ...fieldBase, marginBottom: spacing.sm, borderColor: parentPhone ? colors.brand : colors.borderStrong }}
      />
      {/* Why-it-matters warning at the point of entry — before the confirm popup. */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.warningLight ?? colors.surfaceSunken, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
        <Icon name="warning" size={16} color={colors.warning} style={{ marginTop: 2 }} />
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'right' }}>
          {t('auth.parent_phone_warning')}
        </Text>
      </View>

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

      {/* Rules acknowledgment — must be checked before proceeding to OTP (before any
          account is verified). Student ACKNOWLEDGES rules of use, not a contract. */}
      <TermsConsentRow role="student" checked={termsAccepted} onToggle={setTermsAccepted} />

      {/* Submit — opens the pause-and-reconsider popup before proceeding to OTP. */}
      <TouchableOpacity
        onPress={() => setConfirmOpen(true)}
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

      <PhoneConfirmModal
        visible={confirmOpen}
        phone={parentPhone}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); handleRegister(); }}
      />
    </AuthScaffold>
  );
}
