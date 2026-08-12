import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { router, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/layout/Avatar';
import { searchStudents, type StudentHit } from '@/api/teacher';
import { useGrantBillingOverride } from '@/hooks/useOverrides';
import { formatDayDate } from '@/utils/format';

// Grants run a fixed 15-day exception; preview the day it lapses.
const GRANT_DAYS = 15;

/**
 * Dedicated page to grant a billing exception: search a student by name or code,
 * jump to their profile if needed, then grant. Replaces the cramped bottom-sheet
 * popup — a full page makes the search + profile navigation comfortable.
 */
export default function GrantException() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [reason, setReason] = useState('');
  const grant = useGrantBillingOverride();

  const results = useQuery({
    queryKey: ['student-search', query],
    queryFn: () => searchStudents(query),
    enabled: query.trim().length >= 2 && !selected,
  });

  const submit = () => {
    if (!selected) return;
    grant.mutate(
      { student_id: Number(selected.id), reason: reason.trim() || undefined },
      { onSuccess: () => router.back() },
    );
  };

  const inputStyle = {
    fontFamily: fonts.regular, fontSize: 16, minHeight: 52, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, color: colors.textPrimary, textAlign: 'right' as const,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.grant_billing_override')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        {selected ? (
          <>
            {/* Selected student card + jump to profile */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}>
              <Avatar name={selected.name} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{selected.name}</Text>
                {selected.subtitle ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{selected.subtitle}</Text> : null}
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
              style={{ ...inputStyle, marginTop: spacing.lg }}
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
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: spacing.md }}>
              <Icon name="search" size={18} color={colors.textTertiary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('teacher.search_student')}
                placeholderTextColor={colors.textTertiary}
                autoFocus
                style={{ flex: 1, height: 52, marginStart: spacing.sm, fontFamily: fonts.regular, fontSize: 16, color: colors.textPrimary, textAlign: 'right' }}
              />
            </View>

            {results.isFetching ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} /> : null}

            <View style={{ marginTop: spacing.md }}>
              {(results.data ?? []).map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSelected(s)}
                  activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <Avatar name={s.name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.textPrimary }}>{s.name}</Text>
                    {s.subtitle ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{s.subtitle}</Text> : null}
                  </View>
                  <Icon name="forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
              {query.trim().length >= 2 && !results.isFetching && (results.data ?? []).length === 0 ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xl }}>{t('teacher.no_search_results')}</Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
