import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Share, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useCourses } from '@/hooks/useCourses';
import { mintInviteLink, type MintedInviteLink } from '@/api/invitation';

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

  // A course can only be invited into once it has a weekly schedule.
  const eligible = useMemo(() => (courses ?? []).filter((c) => c.slot_count > 0), [courses]);
  const canSubmit = courseId != null && name.trim().length >= 2 && !busy;

  const submit = async () => {
    if (!canSubmit || courseId == null) return;
    setBusy(true);
    try {
      const res = await mintInviteLink(courseId, name.trim());
      setMinted(res);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('invite_link.failed'));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!minted) return;
    try { await Share.share({ message: `${t('invite_link.share_prefix', { name: minted.student_name })}\n${minted.url}` }); } catch { /* dismissed */ }
  };

  const input = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const };
  const card = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg } as const;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Icon name="back" size={22} color={colors.textPrimary} /></TouchableOpacity>
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
              {t('invite_link.ready_hint', { student: minted.student_name, course: minted.course_name })}
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
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('invite_link.student_name')}</Text>
              <TextInput value={name} onChangeText={setName} placeholder={t('invite_link.name_ph')} placeholderTextColor={colors.textTertiary} maxLength={120} style={input} />
            </View>

            <TouchableOpacity onPress={submit} disabled={!canSubmit} activeOpacity={0.85} style={{ opacity: canSubmit ? 1 : 0.5, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center' }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('invite_link.mint')}</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
