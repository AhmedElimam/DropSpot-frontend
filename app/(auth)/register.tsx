import { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { useRegister } from '@/hooks/useAuth';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { isArabicName, isEgyptPhone } from '@/utils/validators';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { AuthScaffold, AuthBanner } from '@/components/auth/AuthScaffold';
import { AuthField } from '@/components/auth/AuthField';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { PhoneConfirmModal } from '@/components/auth/PhoneConfirmModal';
import { TermsConsentRow } from '@/components/auth/TermsConsentRow';

const RELATIONS: { key: string; icon: IconName }[] = [
  { key: 'father', icon: 'child' },
  { key: 'mother', icon: 'child' },
  { key: 'guardian', icon: 'children' },
  { key: 'other', icon: 'profile' },
];

const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 11);
const fullPhone = (v: string) => v.length === 11 && isEgyptPhone(v);

/**
 * Registration in two short steps — the student, then the parent — instead of one
 * nine-field form. Every rule the server enforces is checked inline as the field is
 * left (Arabic-only names, an 11-digit Egyptian number, 6+ character password), so the
 * first time a family sees red is next to the exact field, not after a submit.
 * The confirm popup → OTP → welcome flow is unchanged.
 */
export default function RegisterScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentRelation, setParentRelation] = useState<string>('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setTouched((s) => ({ ...s, [k]: true }));
  const registerMutation = useRegister();

  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const parentPhoneRef = useRef<TextInput>(null);

  // Inline errors appear once a field was left (or is complete), never mid-keystroke.
  const nameError = name && !isArabicName(name) ? t('auth.name_arabic_only') : null;
  const phoneError = phone && (touched.phone || phone.length === 11) && !fullPhone(phone) ? t('auth.phone_invalid') : null;
  const passwordError = password && touched.password && password.length < 6 ? t('auth.password_too_short') : null;
  const confirmError = confirmPassword && confirmPassword !== password ? t('auth.password_mismatch') : null;
  const parentNameError = parentName && !isArabicName(parentName) ? t('auth.name_arabic_only') : null;
  const parentPhoneError = parentPhone && (touched.parentPhone || parentPhone.length === 11) && !fullPhone(parentPhone) ? t('auth.phone_invalid') : null;
  const samePhoneError = fullPhone(parentPhone) && parentPhone === phone ? t('auth.parent_phone_same') : null;

  const step1Valid = !!name && !nameError && fullPhone(phone) && password.length >= 6 && confirmPassword === password;
  const step2Valid = !!parentName && !parentNameError && fullPhone(parentPhone) && !samePhoneError && !!parentRelation && termsAccepted;

  const handleRegister = () => {
    if (!step1Valid || !step2Valid) return;
    registerMutation.mutate(
      { name, phone_number: phone, password, parent_name: parentName, parent_phone: parentPhone, parent_relation: parentRelation, terms_accepted: termsAccepted },
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

  const goToStep2 = () => {
    if (!step1Valid) { setTouched({ phone: true, password: true }); return; }
    setStep(2);
  };

  return (
    <AuthScaffold
      onBack={() => (step === 2 ? setStep(1) : router.back())}
      title={step === 1 ? t('auth.step_student') : t('auth.step_parent')}
      subtitle={step === 1 ? t('auth.register_subtitle') : t('auth.parent_step_subtitle')}
    >
      <StepBar step={step} total={2} labels={[t('auth.step_student'), t('auth.step_parent')]} />

      {registerMutation.isError ? <AuthBanner tone="danger" text={getFriendlyErrorMessage(registerMutation.error)} /> : null}
      {registerMutation.isSuccess ? <AuthBanner tone="success" text={t('auth.registration_success')} /> : null}

      {step === 1 ? (
        <>
          <AuthField
            label={t('auth.name')} icon="child" value={name} onChangeText={setName}
            autoCapitalize="words" autoCorrect={false} autoComplete="name" textContentType="name"
            placeholder={t('auth.name_example')} error={nameError} hint={t('auth.name_hint')}
            returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} blurOnSubmit={false}
          />
          <AuthField
            ref={phoneRef} label={t('auth.student_phone')} icon="call" value={phone} onChangeText={(v) => setPhone(digits(v))}
            onBlur={() => touch('phone')} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={11}
            placeholder="01xxxxxxxxx" error={phoneError} valid={fullPhone(phone)}
            returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} blurOnSubmit={false}
          />
          <AuthField
            ref={passwordRef} secure label={t('auth.password')} icon="lock" value={password} onChangeText={setPassword}
            onBlur={() => touch('password')} autoComplete="new-password" textContentType="newPassword" placeholder="••••••••"
            error={passwordError} hint={password ? undefined : t('setup.password_hint')}
            returnKeyType="next" onSubmitEditing={() => confirmRef.current?.focus()} blurOnSubmit={false}
          />
          <PasswordStrength password={password} />
          <AuthField
            ref={confirmRef} secure label={t('auth.confirm_password')} icon="lock" value={confirmPassword} onChangeText={setConfirmPassword}
            autoComplete="new-password" textContentType="newPassword" placeholder="••••••••"
            error={confirmError} valid={!!confirmPassword && confirmPassword === password}
            returnKeyType="next" onSubmitEditing={goToStep2} containerStyle={{ marginBottom: spacing.xl }}
          />
          <Button title={t('common.next')} onPress={goToStep2} disabled={!step1Valid} />
        </>
      ) : (
        <>
          <AuthField
            label={t('auth.parent_name')} icon="child" value={parentName} onChangeText={setParentName}
            autoCapitalize="words" autoCorrect={false} placeholder={t('auth.parent_name_example')} error={parentNameError}
            returnKeyType="next" onSubmitEditing={() => parentPhoneRef.current?.focus()} blurOnSubmit={false}
          />
          <AuthField
            ref={parentPhoneRef} label={t('auth.parent_phone')} icon="call" value={parentPhone} onChangeText={(v) => setParentPhone(digits(v))}
            onBlur={() => touch('parentPhone')} keyboardType="phone-pad" maxLength={11} placeholder="01xxxxxxxxx"
            error={parentPhoneError ?? samePhoneError} valid={fullPhone(parentPhone) && !samePhoneError}
            returnKeyType="done" containerStyle={{ marginBottom: spacing.sm }}
          />
          {/* Why-it-matters, at the point of entry — before the confirm popup. */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
            <Icon name="warning" size={18} color={colors.warning} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.warningText }}>
              {t('auth.parent_phone_warning')}
            </Text>
          </View>

          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, marginBottom: 6 }}>{t('auth.parent_relation')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl }}>
            {RELATIONS.map(({ key, icon }) => {
              const on = parentRelation === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setParentRelation(key)}
                  activeOpacity={0.75}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radius.full,
                    backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1.5, borderColor: on ? colors.brand : colors.borderStrong,
                  }}
                >
                  <Icon name={icon} size={18} color={on ? colors.textInverse : colors.textSecondary} outline={!on} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: on ? colors.textInverse : colors.textSecondary }}>{t(`auth.${key}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Rules acknowledgment — must be checked before proceeding to OTP (before any
              account is verified). Student ACKNOWLEDGES rules of use, not a contract. */}
          <TermsConsentRow role="student" checked={termsAccepted} onToggle={setTermsAccepted} />

          <Button title={t('auth.register_button')} onPress={() => setConfirmOpen(true)} disabled={!step2Valid || registerMutation.isPending} loading={registerMutation.isPending} />
          <Button title={t('common.back')} variant="ghost" onPress={() => setStep(1)} style={{ marginTop: spacing.sm }} />
        </>
      )}

      <PhoneConfirmModal
        visible={confirmOpen}
        phone={parentPhone}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); handleRegister(); }}
      />
    </AuthScaffold>
  );
}

/** «الخطوة ١ من ٢» with two bars; the done step is brand, the coming one faint. */
function StepBar({ step, total, labels }: { step: number; total: number; labels: string[] }) {
  const { t } = useTranslation();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{t('auth.step_of', { n: step, total })}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{labels[step - 1]}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < step ? colors.brand : colors.borderLight }} />
        ))}
      </View>
    </View>
  );
}
