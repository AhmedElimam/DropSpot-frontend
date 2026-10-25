import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, ScrollView } from 'react-native';
import { usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppModal as Modal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useWhatsNew } from '@/hooks/useReleaseNotes';
import { usePendingSurvey } from '@/hooks/useSurvey';
import { useTourStore } from '@/tour/store';
import { getTourStatus } from '@/api/tour';
import { sendParentNumberCode, verifyParentNumberCode } from '@/api/parentNumber';
import { OtpInput } from '@/components/auth/OtpInput';
import { NazerFramed } from '@/components/nazer/NazerFramed';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { usePopupSlot } from '@/ui/popupSlot';

const HEAD = 92;
const RESEND_SECONDS = 60;
const BLOCKING_PREFIXES = [
  '/accept-terms', '/change-password', '/verify-own-number', '/parent-setup', '/needs-teacher',
  '/request-name-correction', '/impersonate', '/invite', '/login', '/register', '/verify-otp', '/forgot-password',
  '/reset-password', '/welcome', '/check-in', '/whats-new',
];
const today = () => new Date().toISOString().slice(0, 10);

/**
 * «خلّينا نتأكد من رقم ولي أمرك» (founder 2026-10-24): a student whose parent's number nobody has
 * proved is asked, as they come into the app, to get a code from their parent and type it — the
 * code goes to the PARENT's phone, never the student's (the popup says so). A soft block: «بعدين»
 * puts it off until tomorrow. It waits its turn — after الناظر's popup and the first tour, never
 * over «ما الجديد», a survey or a screen that must be finished. Server: needs_parent_number_check.
 */
export function ParentNumberCheckModal() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const setSession = useAuthStore((s) => s.setSession);
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  const student = role === 'student' && !impersonating;
  const needs = student && !!user?.needs_parent_number_check;
  const laterKey = user ? `parent_check_later:${user.id}` : null;

  const [laterOn, setLaterOn] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!laterKey || !needs) return;
    AsyncStorage.getItem(laterKey).then(setLaterOn).catch(() => setLaterOn(null));
  }, [laterKey, needs]);

  const { data: tour } = useQuery({ queryKey: ['tour-status', user?.id], queryFn: getTourStatus, enabled: needs, staleTime: 5 * 60_000 });
  const touring = useTourStore((s) => s.tour !== null);
  const introHeld = useTourStore((s) => s.introHeld);
  const { showPopup } = useWhatsNew();
  const { data: survey } = usePendingSurvey();
  const pathname = usePathname() ?? '';
  const blocked = BLOCKING_PREFIXES.some((p) => pathname.startsWith(p));

  const [hint, setHint] = useState<string | null>(user?.parent_phone_hint ?? null);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const finish = () => {
    if (user && role) void setSession({ ...user, needs_parent_number_check: false }, role);
  };
  const send = useMutation({
    mutationFn: sendParentNumberCode,
    onSuccess: (r) => {
      setError(null);
      if (r.checked) { finish(); return; }
      if (r.parent_phone_hint) setHint(r.parent_phone_hint);
      setSent(true);
      setCooldown(RESEND_SECONDS);
    },
    onError: (e) => setError(getFriendlyErrorMessage(e)),
  });
  const verify = useMutation({
    mutationFn: (c: string) => verifyParentNumberCode(c),
    onSuccess: () => finish(),
    onError: (e) => { setError(getFriendlyErrorMessage(e)); setCode(''); },
  });

  const later = () => {
    setLaterOn(today());
    if (laterKey) AsyncStorage.setItem(laterKey, today()).catch(() => {});
  };

  // One popup at a time, in order, never over another modal (src/ui/popupSlot.ts).
  const visible = usePopupSlot('parent_number_check', needs && laterOn !== undefined && laterOn !== today() && !!tour?.completed && !touring && !introHeld && !showPopup && !survey && !blocked);
  if (!student) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={later}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: 'rgba(15,12,30,0.6)', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ paddingTop: HEAD / 2, maxHeight: '92%' }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, paddingTop: HEAD / 2 + spacing.sm, ...shadows.md, flexShrink: 1 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 28, color: colors.textPrimary, textAlign: 'center' }}>{t('parent_check.title')}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textTertiary, textAlign: 'center' }}>{t('card_order.intro_sub')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 23, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>{t('parent_check.why')}</Text>
              <View style={{ backgroundColor: colors.brandTint, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 22, color: colors.brand, textAlign: 'center' }}>
                  {sent ? t('parent_check.sent', { hint: hint ?? '' }) : t('parent_check.how', { hint: hint ?? '' })}
                </Text>
              </View>

              {sent ? (
                <View style={{ marginTop: spacing.lg }}>
                  <OtpInput value={code} onChange={(v) => { setCode(v); setError(null); }} error={!!error} onComplete={(c) => { if (!verify.isPending) verify.mutate(c); }} />
                  {error ? <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: spacing.sm }}>{error}</Text> : null}
                  <TouchableOpacity onPress={() => code.length === 6 && verify.mutate(code)} disabled={code.length !== 6 || verify.isPending} activeOpacity={0.85} accessibilityRole="button"
                    style={{ marginTop: spacing.lg, minHeight: 52, borderRadius: radius.lg, backgroundColor: code.length === 6 ? colors.brand : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    {verify.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('parent_check.confirm')}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => cooldown <= 0 && !send.isPending && send.mutate()} disabled={cooldown > 0 || send.isPending} style={{ alignSelf: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: cooldown > 0 ? colors.textTertiary : colors.brand }}>
                      {cooldown > 0 ? t('parent_check.resend_in', { seconds: cooldown }) : t('parent_check.resend')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {error ? <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: spacing.md }}>{error}</Text> : null}
                  <TouchableOpacity onPress={() => send.mutate()} disabled={send.isPending} activeOpacity={0.85} accessibilityRole="button"
                    style={{ marginTop: spacing.lg, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                    {send.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('parent_check.send')}</Text>}
                  </TouchableOpacity>
                </>
              )}

              <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 19, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.md }}>{t('parent_check.wrong_number')}</Text>
              <TouchableOpacity onPress={later} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary }}>{t('parent_check.later')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
            <NazerFramed size={HEAD} blink={false} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
