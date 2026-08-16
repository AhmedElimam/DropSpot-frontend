import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients, control } from '@/theme/index';
import { verifyOtp, resendOtp, changeRegistrationPhone } from '@/api/auth';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { AuthScaffold } from '@/components/auth/AuthScaffold';

const RESEND_COOLDOWN = 60;

export default function VerifyOtpScreen() {
  const { t } = useTranslation();
  const { parent_phone, name } = useLocalSearchParams<{ parent_phone: string; student_id: string; name?: string }>();
  const [code, setCode] = useState('');
  const inputRef = useRef<TextInput>(null);

  // The phone can change in place (correcting a typo) without leaving the screen.
  const [phone, setPhone] = useState(parent_phone ?? '');
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');

  // A code was just sent (on arrival from register) → start the cooldown ticking.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const verifyMutation = useMutation({
    mutationFn: () => verifyOtp(phone, code),
    // Land on the congrats wall (a warm welcome) rather than dropping straight to
    // login — this is the moment the student account actually comes to life.
    onSuccess: () => router.replace(`/(auth)/welcome?name=${encodeURIComponent(name ?? '')}`),
  });

  const resendMutation = useMutation({
    mutationFn: () => resendOtp(phone),
    onSuccess: () => setCooldown(RESEND_COOLDOWN),
  });

  const changePhoneMutation = useMutation({
    mutationFn: () => changeRegistrationPhone(phone, newPhone.trim()),
    onSuccess: (updated) => {
      setPhone(updated);
      setEditingPhone(false);
      setNewPhone('');
      setCode('');
      setCooldown(RESEND_COOLDOWN);
    },
  });

  const handleVerify = () => {
    if (code.length !== 6) return;
    verifyMutation.mutate();
  };

  const handleResend = () => {
    if (cooldown > 0 || resendMutation.isPending) return;
    resendMutation.mutate();
  };

  return (
    <AuthScaffold
      icon="phone"
      title={t('auth.verify_otp_title')}
      subtitle={phone ? `${t('auth.verify_otp_desc')}\n${phone}` : t('auth.verify_otp_desc')}
      footer={
        <TouchableOpacity style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => router.push('/(auth)/login')}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.brand }}>{t('auth.back_to_login')}</Text>
        </TouchableOpacity>
      }
    >
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

      {/* Resend + change-number affordances */}
      {resendMutation.isSuccess && (
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.successText, textAlign: 'center', marginTop: spacing.lg }}>
          {t('auth.resend_sent')}
        </Text>
      )}
      {resendMutation.isError && (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.dangerText, textAlign: 'center', marginTop: spacing.lg }}>
          {getFriendlyErrorMessage(resendMutation.error)}
        </Text>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xl, flexWrap: 'wrap' }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary }}>
          {t('auth.didnt_receive')}
        </Text>
        <TouchableOpacity onPress={handleResend} disabled={cooldown > 0 || resendMutation.isPending} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: cooldown > 0 ? colors.textTertiary : colors.brand }}>
            {resendMutation.isPending
              ? t('common.loading')
              : cooldown > 0
                ? t('auth.resend_in', { seconds: cooldown })
                : t('auth.resend_otp')}
          </Text>
        </TouchableOpacity>
      </View>

      {editingPhone ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <TextInput
            value={newPhone}
            onChangeText={(v) => setNewPhone(v.replace(/[^0-9]/g, '').slice(0, 11))}
            keyboardType="phone-pad"
            placeholder={t('auth.parent_phone')}
            placeholderTextColor={colors.textTertiary}
            style={{
              fontFamily: fonts.medium, fontSize: 17, minHeight: control.minHeight,
              backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: 16,
              color: colors.textPrimary, textAlign: 'center', letterSpacing: 2,
              borderWidth: 1.5, borderColor: colors.borderStrong,
            }}
          />
          {changePhoneMutation.isError && (
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.dangerText, textAlign: 'center' }}>
              {getFriendlyErrorMessage(changePhoneMutation.error)}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => { setEditingPhone(false); setNewPhone(''); changePhoneMutation.reset(); }}
              style={{ flex: 1, minHeight: 48, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => newPhone.trim().length >= 6 && !changePhoneMutation.isPending && changePhoneMutation.mutate()}
              disabled={newPhone.trim().length < 6 || changePhoneMutation.isPending}
              style={{ flex: 1, minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', opacity: newPhone.trim().length < 6 ? 0.5 : 1 }}
            >
              {changePhoneMutation.isPending
                ? <ActivityIndicator color={colors.textInverse} />
                : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textInverse }}>{t('auth.save_number')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setEditingPhone(true)}
          style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xs }}
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.brand }}>
            {t('auth.change_number')}
          </Text>
        </TouchableOpacity>
      )}
    </AuthScaffold>
  );
}
