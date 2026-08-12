import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useRevisions } from '@/hooks/useRevisions';
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

  function pick(rev: RevisionSummary) {
    if (rev.instance_id == null) return; // no slot to scan into
    router.push({
      pathname: '/(teacher)/(tabs)/scan',
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
          <Icon name="back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.revisions_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('teacher.revisions_subtitle')}</Text>
        </View>
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
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }} numberOfLines={1}>{rev.title}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                    {billingLabel(rev.billing_mode, t)}
                    {disabled ? ` · ${t('teacher.revision_no_slot')}` : ''}
                  </Text>
                </View>
                {!disabled ? <Icon name="forward" size={20} color={colors.textSecondary} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <TouchableOpacity onPress={() => refetch()} disabled={isRefetching} accessibilityRole="button" style={{ position: 'absolute', bottom: insets.bottom + spacing.lg, alignSelf: 'center', width: 48, height: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceSunken, borderRadius: radius.full }}>
        {isRefetching ? <ActivityIndicator color={colors.textSecondary} /> : <Icon name="refresh" size={20} color={colors.textSecondary} />}
      </TouchableOpacity>
    </View>
  );
}
