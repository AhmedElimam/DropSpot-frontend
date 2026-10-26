import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, ScrollView } from 'react-native';
import { usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AppModal as Modal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useWhatsNew } from '@/hooks/useReleaseNotes';
import { useTourStore } from '@/tour/store';
import { getParentNumberState, requestParentNumberChange, sendParentNumberCode, verifyParentNumberCode } from '@/api/parentNumber';
import { getStudentTeachers } from '@/api/studentOverview';
import { TeacherChips } from './TeacherChips';
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
/** Arabic-Indic digits typed on an Arabic keyboard → the Latin ones the server checks. */
const latinDigits = (v: string) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\D/g, '');

/**
 * «خلّينا نتأكد من رقم ولي أمرك» (founder 2026-10-24): a student whose parent's number nobody has
 * proved gets a code from their parent and types it — the code goes to the PARENT's phone, never
 * the student's (the popup says so). Since 2026-10-26 it is a LOCK: no «بعدين», the app stays
 * behind it until the number is proved. «ده مش رقم ولي أمري» asks any one of the student's
 * teachers to correct the number; their OK applies it and the student sends the code to the new
 * one. It comes straight after الناظر's popup, before the tour; never over «ما الجديد» or a
 * screen that must be finished. Server: needs_parent_number_check, GET /student/parent-number.
 */
export function ParentNumberCheckModal() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const setSession = useAuthStore((s) => s.setSession);
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  const student = role === 'student' && !impersonating;
  const needs = student && !!user?.needs_parent_number_check;
  const logout = useAuthStore((s) => s.logout);

  // Fresh each time the app comes back: the teacher may have decided the request meanwhile.
  const state = useQuery({ queryKey: ['parent-number-state', user?.id], queryFn: getParentNumberState, enabled: needs, staleTime: 0 });
  const request = state.data?.request ?? null;
  const touring = useTourStore((s) => s.tour !== null);
  const introHeld = useTourStore((s) => s.introHeld);
  const { showPopup } = useWhatsNew();
  const pathname = usePathname() ?? '';
  const blocked = BLOCKING_PREFIXES.some((p) => pathname.startsWith(p));

  const [hint, setHint] = useState<string | null>(user?.parent_phone_hint ?? null);
  useEffect(() => {
    if (state.data?.parent_phone_hint) setHint(state.data.parent_phone_hint);
  }, [state.data?.parent_phone_hint]);
  // «ده مش رقم ولي أمري»: pick a teacher, type the right number.
  const [wrong, setWrong] = useState(false);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const teachers = useQuery({ queryKey: ['student-teachers', user?.student_id ?? null], queryFn: () => getStudentTeachers(user!.student_id as number), enabled: wrong && !!user?.student_id, staleTime: 60_000 });
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
  // Proved elsewhere (a teacher at the door, the parent's own setup): unlock.
  useEffect(() => {
    if (state.data && !state.data.needs) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data?.needs]);
  const ask = useMutation({
    mutationFn: () => requestParentNumberChange({ teacher_id: teacherId!, phone, note: note.trim() || undefined }),
    onSuccess: () => { setError(null); setWrong(false); setSent(false); setPhone(''); setNote(''); void state.refetch(); },
    onError: (e) => setError(getFriendlyErrorMessage(e)),
  });
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

  // One popup at a time, in order, never over another modal (src/ui/popupSlot.ts). It holds the
  // slot until the number is proved, so the tour and every later popup wait behind it.
  const visible = usePopupSlot('parent_number_check', needs && !touring && !introHeld && !showPopup && !blocked);
  if (!student) return null;
  const waiting = request?.status === 'pending';
  const canAsk = !!teacherId && phone.length === 11 && !ask.isPending;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (wrong) setWrong(false); }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: 'rgba(15,12,30,0.6)', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ paddingTop: HEAD / 2, maxHeight: '92%' }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, paddingTop: HEAD / 2 + spacing.sm, ...shadows.md, flexShrink: 1 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 28, color: colors.textPrimary, textAlign: 'center' }}>{t('parent_check.title')}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textTertiary, textAlign: 'center' }}>{t('card_order.intro_sub')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 23, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>{t('parent_check.why')}</Text>
              {request && !wrong ? (
                <View style={{ backgroundColor: request.status === 'rejected' ? colors.dangerLight : request.status === 'approved' ? colors.successLight : colors.accentLight, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 22, color: request.status === 'rejected' ? colors.dangerText : request.status === 'approved' ? colors.successDark : colors.accentText, textAlign: 'center' }}>
                    {request.status === 'pending'
                      ? t('parent_check.pending', { teacher: request.teacher_name ?? '', hint: request.proposed_hint ?? '' })
                      : request.status === 'approved'
                        ? t('parent_check.approved', { teacher: request.teacher_name ?? '' })
                        : t('parent_check.rejected', { teacher: request.teacher_name ?? '', reason: request.rejection_reason ?? '' })}
                  </Text>
                </View>
              ) : null}

              {wrong ? (
                <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, textAlign: 'center' }}>{t('parent_check.wrong_title')}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' }}>{t('parent_check.wrong_body')}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs }}>{t('parent_check.pick_teacher')}</Text>
                  {teachers.isLoading ? <ActivityIndicator color={colors.brand} /> : !(teachers.data ?? []).length ? (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary }}>{t('parent_check.no_teachers')}</Text>
                  ) : (
                    <TeacherChips teachers={teachers.data ?? []} value={teacherId} onChange={setTeacherId} />
                  )}
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs }}>{t('parent_check.right_number')}</Text>
                  <TextInput value={phone} onChangeText={(v) => { setPhone(latinDigits(v).slice(0, 11)); setError(null); }} keyboardType="number-pad" placeholder="01xxxxxxxxx" placeholderTextColor={colors.textTertiary} maxLength={11}
                    style={{ minHeight: 50, borderRadius: radius.lg, borderWidth: 1.5, borderColor: phone.length === 11 ? colors.brand : colors.borderStrong, backgroundColor: colors.surfaceSunken, paddingHorizontal: spacing.md, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center', letterSpacing: 1 }} />
                  <TextInput value={note} onChangeText={setNote} placeholder={t('parent_check.note_ph')} placeholderTextColor={colors.textTertiary} maxLength={300}
                    style={{ minHeight: 46, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSunken, paddingHorizontal: spacing.md, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary }} />
                  {error ? <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.danger, textAlign: 'center' }}>{error}</Text> : null}
                  <TouchableOpacity onPress={() => canAsk && ask.mutate()} disabled={!canAsk} activeOpacity={0.85} accessibilityRole="button"
                    style={{ marginTop: spacing.xs, minHeight: 52, borderRadius: radius.lg, backgroundColor: canAsk ? colors.brand : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    {ask.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('parent_check.send_request')}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setWrong(false); setError(null); }} style={{ alignSelf: 'center', paddingVertical: spacing.sm }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('parent_check.back')}</Text>
                  </TouchableOpacity>
                </View>
              ) : waiting ? null : (
              <>
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

              </>
              )}

              {!wrong ? (
                <>
                  <TouchableOpacity onPress={() => { setWrong(true); setError(null); }} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.xs }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand, textAlign: 'center' }}>{t('parent_check.wrong_number')}</Text>
                  </TouchableOpacity>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 19, color: colors.textTertiary, textAlign: 'center' }}>{t('parent_check.locked')}</Text>
                  <TouchableOpacity onPress={() => void logout()} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.lg }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textTertiary }}>{t('parent_check.logout')}</Text>
                  </TouchableOpacity>
                </>
              ) : null}
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
