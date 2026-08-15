import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, control } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { startPhoneChange, verifyOldPhone, requestNewPhone, confirmPhoneChange } from '@/api/phoneChange';

type Step = 'intro' | 'verify_old' | 'enter_new' | 'verify_new';

const field = {
  fontFamily: fonts.regular,
  fontSize: 18,
  minHeight: control.minHeight,
  backgroundColor: colors.surfaceSunken,
  borderRadius: radius.lg,
  paddingHorizontal: spacing.lg,
  paddingVertical: 14,
  color: colors.textPrimary,
  textAlign: 'center' as const,
  borderWidth: 1.5,
  borderColor: colors.borderStrong,
  letterSpacing: 2,
};

export default function ChangePhoneScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const setSession = useAuthStore((s) => s.setSession);

  const [step, setStep] = useState<Step>('intro');
  const [oldCode, setOldCode] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCode, setNewCode] = useState('');
  const [maskedOld, setMaskedOld] = useState('');
  const [maskedNew, setMaskedNew] = useState('');

  const onErr = (e: unknown) => Alert.alert('', getFriendlyErrorMessage(e));

  const start = useMutation({
    mutationFn: startPhoneChange,
    onSuccess: (d) => { setMaskedOld(d.masked_old_phone); setStep('verify_old'); },
    onError: onErr,
  });
  const verifyOld = useMutation({
    mutationFn: () => verifyOldPhone(oldCode),
    onSuccess: () => setStep('enter_new'),
    onError: onErr,
  });
  const reqNew = useMutation({
    mutationFn: () => requestNewPhone(newPhone.trim()),
    onSuccess: (d) => { setMaskedNew(d.masked_new_phone); setStep('verify_new'); },
    onError: onErr,
  });
  const confirm = useMutation({
    mutationFn: () => confirmPhoneChange(newCode),
    onSuccess: async (d) => {
      if (user && role) await setSession({ ...user, phone: d.phone }, role);
      Alert.alert('', t('auth.change_phone_done'), [{ text: t('common.ok'), onPress: () => router.back() }]);
    },
    onError: onErr,
  });

  const busy = start.isPending || verifyOld.isPending || reqNew.isPending || confirm.isPending;
  const onlyDigits = (s: string, n: number) => s.replace(/[^0-9]/g, '').slice(0, n);

  const Primary = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.85}
      style={{ minHeight: control.minHeight, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1, marginTop: spacing.lg }}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }}>{label}</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('auth.change_phone')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
        {step === 'intro' ? (
          <>
            <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 26, color: colors.textSecondary, textAlign: 'right' }}>
              {t('auth.change_phone_intro')}
            </Text>
            <Primary label={t('auth.change_phone_send_old')} onPress={() => start.mutate()} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textTertiary, textAlign: 'right', marginTop: spacing.xl }}>
              {t('auth.change_phone_lost')}
            </Text>
          </>
        ) : null}

        {step === 'verify_old' ? (
          <>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.md }}>
              {t('auth.change_phone_old_sent', { phone: maskedOld })}
            </Text>
            <TextInput value={oldCode} onChangeText={(v) => setOldCode(onlyDigits(v, 6))} keyboardType="number-pad" placeholder="------" placeholderTextColor={colors.textTertiary} style={field} />
            <Primary label={t('auth.change_phone_verify')} onPress={() => verifyOld.mutate()} disabled={oldCode.length !== 6} />
          </>
        ) : null}

        {step === 'enter_new' ? (
          <>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.md }}>
              {t('auth.change_phone_new_label')}
            </Text>
            <TextInput value={newPhone} onChangeText={(v) => setNewPhone(onlyDigits(v, 15))} keyboardType="phone-pad" placeholder="01000000000" placeholderTextColor={colors.textTertiary} style={{ ...field, letterSpacing: 1, writingDirection: 'ltr' }} />
            <Primary label={t('auth.change_phone_send_new')} onPress={() => reqNew.mutate()} disabled={newPhone.trim().length < 10} />
          </>
        ) : null}

        {step === 'verify_new' ? (
          <>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.md }}>
              {t('auth.change_phone_new_sent', { phone: maskedNew })}
            </Text>
            <TextInput value={newCode} onChangeText={(v) => setNewCode(onlyDigits(v, 6))} keyboardType="number-pad" placeholder="------" placeholderTextColor={colors.textTertiary} style={field} />
            <Primary label={t('auth.change_phone_confirm')} onPress={() => confirm.mutate()} disabled={newCode.length !== 6} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
