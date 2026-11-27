import { useEffect, useState } from 'react';
import { configRule } from '@/stores/appConfigStore';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView } from 'react-native';
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
import { sendOwnNumberOtp, verifyOwnNumber } from '@/api/ownNumber';
import { OtpInput } from '@/components/auth/OtpInput';

/** The countdown is a backend rule (/admin/config → otp_resend_seconds), read when the screen opens. */
const RESEND_COOLDOWN = () => configRule('otp_resend_seconds');

/**
 * Own-number verification. Two ways in, and they must not feel the same:
 *
 *  - AS A WALL: reached from app/index.tsx when `needs_own_number_verification` is set
 *    (24 hours after the first sign-in, the number still unproved). No way back.
 *  - BY CHOICE: opened from the profile row when the number simply is not proved yet.
 *    Then there IS a back button, because nothing is being withheld.
 *
 * The student can NOT change the number here (founder, 2026-11-26). Nothing is sent on
 * its own: one code goes to the number on file each time they press the button. A wrong
 * number is corrected by their teacher, who proves the new one with a code on the spot.
 */

export default function VerifyOwnNumberScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);

  // A hard block only when the server says so — never merely because this screen is open.
  const walled = !!user?.needs_own_number_verification;

  const [code, setCode] = useState('');
  const [masked, setMasked] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // One code per press, never on its own.
  const send = useMutation({
    mutationFn: sendOwnNumberOtp,
    onSuccess: (r) => { setMasked(r.masked_phone); setCooldown(RESEND_COOLDOWN()); },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const verify = useMutation({
    mutationFn: () => verifyOwnNumber(code),
    onSuccess: async () => {
      // Clear the flag locally and drop into the student app. await: the store commits
      // only after an async persist, so navigating first can re-read the stale flag.
      if (user && role) await setSession({ ...user, needs_own_number_verification: false }, role);
      router.replace('/(student)/(tabs)' as Href);
    },
  });

  const canVerify = code.length === 6 && !verify.isPending;
  const err = verify.isError ? verify.error : send.isError ? send.error : null;
  const sent = !!masked;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      >
        {walled ? (
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.onHeroChip, justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="call" size={20} color={colors.onHero} />
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.onHeroChip, justifyContent: 'center', alignItems: 'center' }}
          >
            <Icon name="forward" size={22} color={colors.onHero} />
          </TouchableOpacity>
        )}
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.onHero }}>{t('own_number.title')}</Text>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadows.sm }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginBottom: spacing.lg }}>
              {t('own_number.hint')}
            </Text>

            {sent && (
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.lg }}>
                {t('own_number.sent_to')} <Text style={{ fontFamily: fonts.bold }}>{masked}</Text>
              </Text>
            )}

            {err && (
              <View style={{ backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.danger }}>
                <Icon name="warning" size={18} color={colors.danger} />
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.danger }}>{getFriendlyErrorMessage(err)}</Text>
              </View>
            )}

            {sent ? (
              <>
                <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('own_number.code_label')}</Text>
                {/* The same fitted code cells as the other OTP screens (OtpInput). */}
                <OtpInput value={code} onChange={setCode} onComplete={() => { if (!verify.isPending) verify.mutate(); }} autoFocus />

                <TouchableOpacity
                  onPress={() => canVerify && verify.mutate()}
                  disabled={!canVerify}
                  style={{ marginTop: spacing.lg, minHeight: control.minHeight, borderRadius: radius.lg, backgroundColor: canVerify ? colors.primary : colors.border, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}
                >
                  {verify.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('own_number.verify')}</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => cooldown <= 0 && !send.isPending && send.mutate()} disabled={cooldown > 0 || send.isPending} style={{ marginTop: spacing.lg, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: cooldown > 0 ? colors.textTertiary : colors.primary }}>
                    {cooldown > 0 ? t('own_number.resend_in', { seconds: cooldown }) : t('own_number.resend')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => !send.isPending && send.mutate()}
                disabled={send.isPending}
                accessibilityRole="button"
                style={{ minHeight: control.minHeight, borderRadius: radius.lg, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}
              >
                {send.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('own_number.send_code')}</Text>}
              </TouchableOpacity>
            )}

            {/* Not their number? Only the teacher can correct it (and proves it on the spot). */}
            <View style={{ marginTop: spacing.xl, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <Icon name="info" size={18} color={colors.textSecondary} />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>{t('own_number.wrong_number_teacher')}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => logout()} style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textTertiary }}>{t('auth.logout')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
