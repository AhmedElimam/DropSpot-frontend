import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Share, Alert, KeyboardAvoidingView, Switch } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useCourses } from '@/hooks/useCourses';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { mintInviteLink, type MintedInviteLink } from '@/api/invitation';
import { getPaymentMethods, saveBookingTemplate, type BookingTemplate } from '@/api/paymentMethods';
import { isArabicName } from '@/utils/validators';

/**
 * Invite-by-link (mobile parity for the web "رابط مُعبّأ" channel): the teacher picks
 * a course + student name, mints a single-use link, and shares it with the family —
 * who open it, confirm, and self-register into that course. No phone number needed.
 */
export default function InviteLink() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: courses, isLoading } = useCourses();

  const [courseId, setCourseId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [minted, setMinted] = useState<MintedInviteLink | null>(null);

  // Editable rules/conditions template shown atop the family booking page (teacher-only).
  const { isAssistant } = useActiveAbilities();
  const qc = useQueryClient();
  const { data: pm } = useQuery({ queryKey: ['payment-methods'], queryFn: getPaymentMethods, enabled: !isAssistant });
  const [tpl, setTpl] = useState<BookingTemplate | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  useEffect(() => {
    if (pm && !tpl) setTpl({
      booking_link_rules: pm.booking_link_rules,
      booking_link_font: pm.booking_link_font,
      booking_link_font_size: pm.booking_link_font_size,
      booking_link_bold: pm.booking_link_bold,
    });
  }, [pm, tpl]);
  const saveTpl = useMutation({
    mutationFn: (t: BookingTemplate) => saveBookingTemplate(t),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-methods'] }); Alert.alert(t('invite_link.template_saved')); },
    onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('invite_link.failed')),
  });
  const setTplField = (patch: Partial<BookingTemplate>) => setTpl((s) => (s ? { ...s, ...patch } : s));

  // A course can only be invited into once it has a weekly schedule.
  const eligible = useMemo(() => (courses ?? []).filter((c) => c.slot_count > 0), [courses]);
  // The student name is OPTIONAL now — the family fills it on the booking form. If the
  // teacher does pre-fill it, it must be Arabic (same rule as the server).
  const nameError = name.trim() !== '' && !isArabicName(name);
  const canSubmit = courseId != null && !nameError && !busy;

  const submit = async () => {
    if (!canSubmit || courseId == null) return;
    setBusy(true);
    try {
      const res = await mintInviteLink(courseId, name.trim() || undefined);
      setMinted(res);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('invite_link.failed'));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!minted) return;
    try { await Share.share({ message: `${t('invite_link.share_prefix', { name: minted.student_name || minted.course_name })}\n${minted.url}` }); } catch { /* dismissed */ }
  };

  const input = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const };
  const card = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg } as const;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Icon name="forward" size={22} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('invite_link.title')}</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.lg }}>
          {t('invite_link.intro')}
        </Text>

        {minted ? (
          <View style={card}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.success, marginBottom: spacing.xs }}>{t('invite_link.ready')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              {t('invite_link.ready_hint', { student: minted.student_name || t('invite_link.the_family'), course: minted.course_name })}
            </Text>
            <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary }} selectable>{minted.url}</Text>
            </View>
            <TouchableOpacity onPress={share} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.md }}>
              <Icon name="forward" size={18} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('invite_link.share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setMinted(null); setName(''); }} activeOpacity={0.85} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('invite_link.another')}</Text>
            </TouchableOpacity>
          </View>
        ) : isLoading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
        ) : eligible.length === 0 ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>{t('invite_link.no_courses')}</Text>
        ) : (
          <>
            <View style={card}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('invite_link.course')}</Text>
              {eligible.map((c) => (
                <TouchableOpacity key={c.id} onPress={() => setCourseId(Number(c.id))} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: courseId === Number(c.id) ? colors.brand : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    {courseId === Number(c.id) ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand }} /> : null}
                  </View>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary }}>{c.name}{c.grade_name ? ` — ${c.grade_name}` : ''}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={card}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('invite_link.student_name_optional')}</Text>
              <TextInput value={name} onChangeText={setName} placeholder={t('invite_link.name_ph_optional')} placeholderTextColor={colors.textTertiary} maxLength={120} style={{ ...input, borderColor: nameError ? colors.danger : colors.border }} />
              {nameError ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 6 }}>{t('invite_phone.name_arabic_error')}</Text> : null}
            </View>

            <TouchableOpacity onPress={submit} disabled={!canSubmit} activeOpacity={0.85} style={{ opacity: canSubmit ? 1 : 0.5, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center' }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('invite_link.mint')}</Text>}
            </TouchableOpacity>

            {/* Editable rules/conditions template shown atop the family booking page. */}
            {!isAssistant && tpl ? (
              <View style={[card, { marginTop: spacing.lg }]}>
                <TouchableOpacity onPress={() => setTplOpen((o) => !o)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name="note" size={18} color={colors.brand} outline />
                  <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('invite_link.template_title')}</Text>
                  <Icon name={tplOpen ? 'down' : 'back'} size={16} color={colors.textTertiary} />
                </TouchableOpacity>

                {tplOpen ? (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('invite_link.template_hint')}</Text>
                    <TextInput
                      value={tpl.booking_link_rules ?? ''}
                      onChangeText={(v) => setTplField({ booking_link_rules: v })}
                      placeholder={t('invite_link.template_ph')}
                      placeholderTextColor={colors.textTertiary}
                      multiline
                      maxLength={2000}
                      style={{ backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md, minHeight: 90, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right', textAlignVertical: 'top' }}
                    />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm }}>{t('billing_settings.font')}</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                      {(['default', 'cairo', 'tajawal', 'amiri'] as const).map((f) => {
                        const on = tpl.booking_link_font === f;
                        return (
                          <TouchableOpacity key={f} onPress={() => setTplField({ booking_link_font: f })} activeOpacity={0.85}
                            style={{ paddingHorizontal: spacing.md, height: 36, justifyContent: 'center', borderRadius: radius.full, borderWidth: 1.5, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surfaceSunken }}>
                            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: on ? colors.brand : colors.textSecondary }}>{t(`billing_settings.font_${f}`)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg, marginTop: spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('billing_settings.size')}</Text>
                        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                          {(['sm', 'md', 'lg'] as const).map((s) => {
                            const on = tpl.booking_link_font_size === s;
                            return (
                              <TouchableOpacity key={s} onPress={() => setTplField({ booking_link_font_size: s })} activeOpacity={0.85}
                                style={{ paddingHorizontal: spacing.md, height: 36, justifyContent: 'center', borderRadius: radius.full, borderWidth: 1.5, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surfaceSunken }}>
                                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: on ? colors.brand : colors.textSecondary }}>{t(`billing_settings.size_${s}`)}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('billing_settings.bold')}</Text>
                        <Switch value={tpl.booking_link_bold} onValueChange={(v) => setTplField({ booking_link_bold: v })} trackColor={{ true: colors.brand }} />
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => saveTpl.mutate(tpl)} disabled={saveTpl.isPending} activeOpacity={0.85}
                      style={{ marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', opacity: saveTpl.isPending ? 0.6 : 1 }}>
                      {saveTpl.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('invite_link.save_template')}</Text>}
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
