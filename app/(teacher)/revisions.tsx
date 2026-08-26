import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useRevisions } from '@/hooks/useRevisions';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { GuestPassModal } from '@/components/teacher/GuestPassModal';
import type { BillingMode, RevisionSummary } from '@/api/revisions';

function billingLabel(mode: BillingMode, t: (k: string) => string): string {
  if (mode === 'bucket') return t('teacher.billing_bucket');
  if (mode === 'spread') return t('teacher.billing_spread');
  return t('teacher.billing_free');
}

export default function TeacherRevisions() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: revisions, isLoading, refetch, isRefetching } = useRevisions();
  const { can } = useActiveAbilities();
  const canIssuePass = can(ABILITY.ISSUE_GUEST_PASSES);
  // The session a guest pass is being issued for (null = sheet closed).
  const [guestFor, setGuestFor] = useState<{ id: number; instanceId: number; title: string } | null>(null);

  function pick(rev: RevisionSummary) {
    if (rev.instance_id == null) return; // no slot to scan into
    router.push({
      pathname: '/(teacher)/scan',
      params: {
        revisionId: String(rev.id),
        revisionInstanceId: String(rev.instance_id),
        revisionTitle: rev.title,
        billingMode: rev.billing_mode,
      },
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}
        >
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.revisions_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('teacher.revisions_subtitle')}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(teacher)/revision-create')}
          accessibilityLabel={t('revision_create.title')}
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' }}
        >
          <Icon name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (revisions ?? []).length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <Icon name="book" size={48} color={colors.textSecondary} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg }}>
            {t('teacher.revisions_empty')}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          refreshControl={undefined}
        >
          {(revisions ?? []).map((rev) => {
            const disabled = rev.instance_id == null;
            return (
              <TouchableOpacity
                key={rev.id}
                onPress={() => pick(rev)}
                activeOpacity={disabled ? 1 : 0.8}
                disabled={disabled}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  opacity: disabled ? 0.55 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="scan" size={22} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{rev.title}</Text>
                    {rev.is_quiz_exam ? (
                      <View style={{ backgroundColor: colors.brand + '22', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.brand }}>{t('teacher.exam_badge')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                    {billingLabel(rev.billing_mode, t)}
                    {disabled ? ` · ${t('teacher.revision_no_slot')}` : ''}
                  </Text>
                </View>
                {/* Add a guest to THIS session — issues a one-time pass, no scanner drilling. */}
                {canIssuePass && !disabled ? (
                  <TouchableOpacity
                    onPress={() => setGuestFor({ id: rev.id, instanceId: rev.instance_id as number, title: rev.title })}
                    accessibilityLabel={t('teacher.guest_pass_issue')}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.md, backgroundColor: colors.brandTint, justifyContent: 'center' }}
                  >
                    <Icon name="add" size={16} color={colors.brand} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.guest_add_short')}</Text>
                  </TouchableOpacity>
                ) : null}
                {/* A quiz_exam offers a marks shortcut in addition to scanning students in. */}
                {rev.is_quiz_exam && rev.instance_id != null ? (
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/(teacher)/revision-marks', params: { revisionId: String(rev.id), instanceId: String(rev.instance_id), title: rev.title, maxMark: rev.max_mark != null ? String(rev.max_mark) : '' } })}
                    style={{ paddingHorizontal: spacing.md, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, justifyContent: 'center', alignItems: 'center' }}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.exam_marks')}</Text>
                  </TouchableOpacity>
                ) : (!disabled && !canIssuePass ? <Icon name="back" size={20} color={colors.textSecondary} /> : null)}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <TouchableOpacity onPress={() => refetch()} disabled={isRefetching} accessibilityRole="button" style={{ position: 'absolute', bottom: insets.bottom + spacing.lg, alignSelf: 'center', width: 48, height: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceSunken, borderRadius: radius.full }}>
        {isRefetching ? <ActivityIndicator color={colors.textSecondary} /> : <Icon name="refresh" size={20} color={colors.textSecondary} />}
      </TouchableOpacity>

      <GuestPassModal
        visible={!!guestFor}
        revisionId={guestFor?.id ?? null}
        instanceId={guestFor?.instanceId ?? null}
        sessionTitle={guestFor?.title}
        onClose={() => setGuestFor(null)}
      />
    </View>
  );
}
