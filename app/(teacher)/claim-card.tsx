import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/ui/dialog';
import { Surface } from '@/ui/surfaces';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { getTeacherStudents, type RosterStudent } from '@/api/students';
import { claimTeacherCard, lookupTeacherCard } from '@/api/teacherCards';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { SwitchRow } from '@/components/ui/Form';
import { handBackToDoor } from '@/stores/doorHandoff';

/** The server's own words for a refusal (staff screen, Arabic, written for this door). */
function serverMessage(e: unknown): string {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof m === 'string' && m.trim() ? m : getFriendlyErrorMessage(e);
}

function serverCode(e: unknown): string | null {
  const c = (e as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
  return typeof c === 'string' ? c : null;
}

/** Arabic letters folded so «احمد» finds «أحمد». */
function fold(s: string): string {
  return s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
}

/**
 * «اربط الكارت بطالب» — opened from the door's popup on a blank «كارت المدرّس». The card is
 * tied to one of this teacher's students (already registered, so the parent's check already
 * happened). A new student is registered first, then the card is scanned again.
 *
 * «ربط الكارت وتحضير الطالب الآن» (on by default, founder 2026-11-05): the student is at the
 * door, so the linked card goes straight back to the scanner and checks in through the ordinary
 * scan. Off, the link records no attendance. Linking from the student's profile
 * (claim-card-scan) never checks in.
 */
export default function ClaimCardScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { can } = useActiveAbilities();
  const { card } = useLocalSearchParams<{ card?: string }>();
  const code = typeof card === 'string' ? card : '';
  const [q, setQ] = useState('');
  const [checkIn, setCheckIn] = useState(true);

  const lookup = useQuery({ queryKey: ['teacher-card', code], queryFn: () => lookupTeacherCard(code), enabled: !!code, retry: false });
  const blank = lookup.data?.status === 'unclaimed';
  const roster = useQuery({ queryKey: ['teacher-cards', 'roster'], queryFn: () => getTeacherStudents(), enabled: blank, staleTime: 60_000 });

  const rows = useMemo(() => {
    const all = roster.data ?? [];
    const needle = fold(q);
    if (!needle) return all;
    return all.filter((s) => fold(`${s.name ?? ''} ${s.student_code ?? ''} ${s.phone ?? ''} ${(s.parent_phones ?? []).join(' ')}`).includes(needle));
  }, [roster.data, q]);

  const claim = useMutation({
    mutationFn: ({ student, replace }: { student: RosterStudent; replace: boolean }) => claimTeacherCard(code, Number(student.id), replace),
    onSuccess: (message) => {
      qc.invalidateQueries({ queryKey: ['teacher-cards'] });
      if (checkIn) {
        // The scanner's own result (checked in, or why not) is the confirmation.
        handBackToDoor(code);
      } else {
        Alert.alert(message || t('teacher_cards.claimed'));
      }
      router.back();
    },
    onError: (e, { student }) => {
      if (serverCode(e) === 'TEACHER_CARD_STUDENT_HAS_ONE') {
        Alert.alert(t('teacher_cards.has_one_title'), serverMessage(e), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('teacher_cards.replace_lost'), style: 'destructive', onPress: () => claim.mutate({ student, replace: true }) },
        ]);
        return;
      }
      Alert.alert(t('teacher_cards.refused_title'), serverMessage(e));
    },
  });

  const pick = (s: RosterStudent) => {
    Alert.alert(t('teacher_cards.confirm_title'), t('teacher_cards.confirm_body', { name: s.name ?? '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t(checkIn ? 'teacher_cards.claim_check_in_btn' : 'teacher_cards.claim'), onPress: () => claim.mutate({ student: s, replace: false }) },
    ]);
  };

  const status = lookup.data;
  const notBlank = !!status && !blank;

  return (
    <Surface id="screen.teacher.claim-card" screen>
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher_cards.claim_title')}</Text>
      </View>

      {/* The card itself: number and state. */}
      <View style={{ margin: spacing.lg, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: notBlank || lookup.isError ? colors.danger : colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="card" size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          {lookup.isLoading ? <ActivityIndicator color={colors.primary} /> : lookup.isError ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.danger }}>{serverMessage(lookup.error)}</Text>
          ) : status ? (
            <>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('teacher_cards.card_no', { seq: status.seq })}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: notBlank ? colors.danger : colors.textSecondary, marginTop: 2 }}>
                {status.status_label}{status.student?.name ? ` · ${status.student.name}` : ''}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      {blank ? (
        <>
          <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: checkIn ? colors.brand : colors.border }}>
            <SwitchRow first title={t('teacher_cards.claim_check_in')} value={checkIn} onChange={setCheckIn}
              hint={t(checkIn ? 'teacher_cards.claim_check_in_hint' : 'teacher_cards.claim_hint')} />
          </View>
          <View style={{ marginHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 48, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.brand }}>
            <Icon name="search" size={18} color={colors.brand} />
            <TextInput value={q} onChangeText={setQ} placeholder={t('teacher_cards.search')} placeholderTextColor={colors.textTertiary}
              autoCorrect={false} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }} />
          </View>
          <FlatList
            data={rows}
            keyExtractor={(s) => s.id}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={7}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => pick(item)} disabled={claim.isPending} activeOpacity={0.85} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, marginBottom: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <Icon name="child" size={20} color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{item.name ?? '—'}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                    {[item.grade_name, (item.course_names ?? []).join('، ')].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={roster.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>{t('teacher_cards.no_match')}</Text>
            )}
            ListFooterComponent={can(ABILITY.MANAGE_STUDENTS) ? (
              <TouchableOpacity onPress={() => router.push('/(teacher)/record-student' as Href)} activeOpacity={0.85} accessibilityRole="button"
                style={{ marginTop: spacing.md, height: 48, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm }}>
                <Icon name="add" size={18} color={colors.brand} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('teacher_cards.new_student')}</Text>
              </TouchableOpacity>
            ) : null}
          />
        </>
      ) : null}
    </View>
    </Surface>
  );
}
