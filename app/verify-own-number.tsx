import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients, control, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { sendOwnNumberOtp, verifyOwnNumber, changeOwnNumber } from '@/api/ownNumber';

const RESEND_COOLDOWN = 60;

const field = {
  fontFamily: fonts.regular,
  fontSize: 17,
  minHeight: control.minHeight,
  backgroundColor: colors.surfaceSunken,
  borderRadius: radius.lg,
  paddingHorizontal: spacing.lg,
  paddingVertical: 14,
  color: colors.textPrimary,
  textAlign: 'right' as const,
  borderWidth: 1.5,
  borderColor: colors.border,
};

/**
 * Deferred own-number verification WALL (hard block). Reached from app/index.tsx when
 * `user.needs_own_number_verification` is set. No back button: the rest of the app is
 * unreachable until one specific number is actually OTP-verified. Correcting a wrong
 * Space phone number is possible, but the user must enter a new number and verify it. Each
 * number sends a FRESH code and keeps the wall up — it never clears by re-typing.
 */

export default function VerifyOwnNumberScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);

  const [code, setCode] = useState('');
  const [masked, setMasked] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [editing, setEditing] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const codeRef = useRef<TextInput>(null);

  // Send the first code as the wall opens.
  const send = useMutation({
    mutationFn: sendOwnNumberOtp,
    onSuccess: (r) => { setMasked(r.masked_phone); setCooldown(RESEND_COOLDOWN); },
  });
  useEffect(() => { send.mutate(); /* once on mount */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const verify = useMutation({
    mutationFn: () => verifyOwnNumber(code),
    onSuccess: () => {
      // Clear the flag locally and drop into the student app.
      if (user && role) setSession({ ...user, needs_own_number_verification: false }, role);
      router.replace('/(student)' as Href);
    },
  });

  const change = useMutation({
    mutationFn: () => changeOwnNumber(newPhone.trim()),
    onSuccess: (r) => {
      setMasked(r.masked_phone);
      setEditing(false);
      setNewPhone('');
      setCode('');
      setCooldown(RESEND_COOLDOWN);
    },
  });

  const canVerify = code.length === 6 && !verify.isPending;
  const err = verify.isError ? verify.error : change.isError ? change.error : send.isError ? send.error : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="call" size={20} color="#fff" />
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: '#fff' }}>{t('own_number.title')}</Text>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadows.sm }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.lg }}>
              {t('own_number.hint')}
            </Text>

            {!!masked && !editing && (
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.lg }}>
                {t('own_number.sent_to')} <Text style={{ fontFamily: fonts.bold }}>{masked}</Text>
              </Text>
            )}

            {err && (
              <View style={{ backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.danger }}>
                <Icon name="warning" size={18} color={colors.danger} />
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.danger, textAlign: 'right' }}>{getFriendlyErrorMessage(err)}</Text>
              </View>
            )}

            {editing ? (
              <>
                <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.sm }}>{t('own_number.new_number_label')}</Text>
                <TextInput
                  value={newPhone}
                  onChangeText={setNewPhone}
                  keyboardType="phone-pad"
                  placeholder={t('own_number.new_number_placeholder')}
                  placeholderTextColor={colors.textTertiary}
                  style={field}
                  editable={!change.isPending}
                />
                <TouchableOpacity
                  onPress={() => newPhone.trim().length >= 6 && !change.isPending && change.mutate()}
                  disabled={newPhone.trim().length < 6 || change.isPending}
                  style={{ marginTop: spacing.lg, minHeight: control.minHeight, borderRadius: radius.lg, backgroundColor: newPhone.trim().length >= 6 ? colors.primary : colors.border, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}
                >
                  {change.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('own_number.save_number')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setEditing(false); setNewPhone(''); }} style={{ marginTop: spacing.md, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.sm }}>{t('own_number.code_label')}</Text>
                <TextInput
                  ref={codeRef}
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="------"
                  placeholderTextColor={colors.textTertiary}
                  style={{ ...field, textAlign: 'center', letterSpacing: 8, fontFamily: fonts.bold, fontSize: 22 }}
                  editable={!verify.isPending}
                />

                <TouchableOpacity
                  onPress={() => canVerify && verify.mutate()}
                  disabled={!canVerify}
                  style={{ marginTop: spacing.lg, minHeight: control.minHeight, borderRadius: radius.lg, backgroundColor: canVerify ? colors.primary : colors.border, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}
                >
                  {verify.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('own_number.verify')}</Text>}
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg }}>
                  <TouchableOpacity onPress={() => setEditing(true)}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.primary }}>{t('own_number.wrong_number')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => cooldown <= 0 && !send.isPending && send.mutate()} disabled={cooldown > 0 || send.isPending}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: cooldown > 0 ? colors.textTertiary : colors.primary }}>
                      {cooldown > 0 ? t('own_number.resend_in', { seconds: cooldown }) : t('own_number.resend')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          <TouchableOpacity onPress={() => logout()} style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textTertiary }}>{t('auth.logout')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
