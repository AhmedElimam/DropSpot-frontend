import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, FlatList } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/layout/Avatar';
import { StudentRow } from '@/components/student/StudentRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTeacherStudents } from '@/hooks/useStudents';
import { useGrantBillingOverride, useAllowanceSetting, useSetAllowanceSetting } from '@/hooks/useOverrides';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { formatDayDate } from '@/utils/format';

// Grants run a fixed 15-day exception; preview the day it lapses.
const GRANT_DAYS = 15;

/**
 * Grant a billing exception. Shows the teacher's student roster (like the الطلاب
 * tab, searchable) — pick a student, optionally jump to their profile, then grant.
 * A populated list on open beats an empty search box.
 */
export default function GrantException() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState('');
  const grant = useGrantBillingOverride();
  const { data: students, isLoading } = useTeacherStudents({});
  const { isAssistant } = useActiveAbilities();
  const { data: allowance } = useAllowanceSetting();
  const setAllowance = useSetAllowanceSetting();
  const allowanceOn = allowance?.enabled ?? true;

  // Search filters the loaded roster client-side (same as the students tab).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students ?? [];
    return (students ?? []).filter(
      (s) => (s.name ?? '').toLowerCase().includes(q) || (s.student_code ?? '').toLowerCase().includes(q),
    );
  }, [students, search]);

  const submit = () => {
    if (!selected) return;
    grant.mutate(
      { student_id: Number(selected.id), reason: reason.trim() || undefined },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.grant_billing_override')}</Text>
      </View>

      {/* Teacher-wide master switch (teacher-only; assistants can't change policy). */}
      {!isAssistant ? (
        <TouchableOpacity
          onPress={() => setAllowance.mutate(!allowanceOn)}
          disabled={setAllowance.isPending}
          activeOpacity={0.8}
          style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: allowanceOn ? colors.border : colors.warning, padding: spacing.md }}
        >
          <Icon name="calendar" size={22} color={allowanceOn ? colors.brand : colors.warningText} outline />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('teacher.allowance_setting_title')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              {allowanceOn ? t('teacher.allowance_on_hint') : t('teacher.allowance_off_hint')}
            </Text>
          </View>
          {setAllowance.isPending ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <View style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: allowanceOn ? colors.success : colors.borderStrong, justifyContent: 'center', paddingHorizontal: 3, alignItems: allowanceOn ? 'flex-end' : 'flex-start' }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' }} />
            </View>
          )}
        </TouchableOpacity>
      ) : null}

      {selected ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
          {/* Selected student card + jump to profile */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}>
            <Avatar name={selected.name} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{selected.name}</Text>
            </View>
            <TouchableOpacity onPress={() => { setSelected(null); setReason(''); }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.primary }}>{t('teacher.change')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.push(`/(teacher)/students/${selected.id}` as Href)}
            activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md, minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
          >
            <Icon name="profile" size={18} color={colors.brand} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand }}>{t('teacher.view_profile')}</Text>
          </TouchableOpacity>

          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t('teacher.reason_optional')}
            placeholderTextColor={colors.textTertiary}
            style={{ fontFamily: fonts.regular, fontSize: 16, minHeight: 52, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, paddingHorizontal: spacing.lg, color: colors.textPrimary, textAlign: 'right', marginTop: spacing.lg }}
          />

          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
            {t('teacher.exception_ends', { date: formatDayDate(new Date(Date.now() + GRANT_DAYS * 86_400_000)) })}
          </Text>

          <TouchableOpacity
            onPress={submit}
            disabled={grant.isPending}
            style={{ marginTop: spacing.lg, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}
          >
            {grant.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('teacher.grant_15_days')}</Text>}
          </TouchableOpacity>

          {grant.isError ? (
            <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.dangerLight, borderRadius: radius.lg, padding: spacing.md }}>
              <Icon name="warning" size={18} color={colors.dangerText} outline />
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.dangerText }}>
                {getFriendlyErrorMessage(grant.error)}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <>
          {/* Search over the roster */}
          <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}>
            <Icon name="search" size={18} color={colors.textTertiary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('teacher.search_student_ph')}
              placeholderTextColor={colors.textTertiary}
              style={{ flex: 1, height: 46, marginStart: spacing.sm, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }}
            />
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(s) => s.id}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom, paddingTop: spacing.sm }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <StudentRow
                  id={item.id}
                  name={item.name ?? '—'}
                  studentCode={item.student_code ?? ''}
                  grade={item.grade_name ?? undefined}
                  onPress={(id) => setSelected({ id, name: item.name ?? '—' })}
                />
              )}
              ListEmptyComponent={<EmptyState icon="children" title={t('teacher.no_students')} message={t('teacher.no_students_hint')} />}
            />
          )}
        </>
      )}
    </View>
  );
}
