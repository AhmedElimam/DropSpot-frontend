import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormScreen, HeaderAction, HeaderCount } from '@/components/ui/Form';
import { useRevisions } from '@/hooks/useRevisions';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { GuestPassModal } from '@/components/teacher/GuestPassModal';
import { Surface, useSurfaceState } from '@/ui/surfaces';
import type { BillingMode, RevisionSummary } from '@/api/revisions';

function billingLabel(mode: BillingMode, t: (k: string) => string): string {
  if (mode === 'bucket') return t('teacher.billing_bucket');
  if (mode === 'spread') return t('teacher.billing_spread');
  return t('teacher.billing_free');
}

/** «المراجعات» — the revision / exam sessions; tap one to scan into it. */
export default function TeacherRevisions() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: revisions, isLoading, refetch } = useRevisions();
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  // The guest-pass gate (issue_guest_passes, or the server's override) decides whether a row
  // gets its action strip at all — read here so a non-exam row shows no empty strip.
  const canIssuePass = !useSurfaceState('teacher.revisions.guest_pass_button', undefined, 'issue_guest_passes').hidden;
  // The session a guest pass is being issued for (null = sheet closed).
  const [guestFor, setGuestFor] = useState<{ id: number; instanceId: number; title: string } | null>(null);
  const list = revisions ?? [];

  function pick(rev: RevisionSummary) {
    if (rev.instance_id == null) return; // no slot to scan into
    router.push({ pathname: '/(teacher)/scan', params: { revisionId: String(rev.id), revisionInstanceId: String(rev.instance_id), revisionTitle: rev.title, billingMode: rev.billing_mode } });
  }

  const renderRow = ({ item: rev }: { item: RevisionSummary }) => {
    const disabled = rev.instance_id == null;
    const tint = rev.is_quiz_exam ? colors.accent : colors.brand;
    return (
      <TouchableOpacity onPress={() => pick(rev)} activeOpacity={disabled ? 1 : 0.85} disabled={disabled} accessibilityRole="button"
        style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, borderStartWidth: 5, borderStartColor: disabled ? colors.borderStrong : tint, padding: spacing.md, marginBottom: spacing.sm, opacity: disabled ? 0.6 : 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tint + '1A', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name={rev.is_quiz_exam ? 'trophy' : 'book'} size={22} color={tint} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{rev.title}</Text>
              {rev.is_quiz_exam ? (
                <View style={{ backgroundColor: colors.accentLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.accentText }}>{t('teacher.exam_badge')}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>
              {billingLabel(rev.billing_mode, t)}{disabled ? ` · ${t('teacher.revision_no_slot')}` : ''}
            </Text>
          </View>
          {!disabled ? <Icon name="scan" size={20} color={tint} /> : null}
        </View>
        {!disabled && (canIssuePass || rev.is_quiz_exam) ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Surface id="teacher.revisions.guest_pass_button" assistantNeeds="issue_guest_passes">
              <TouchableOpacity onPress={() => setGuestFor({ id: rev.id, instanceId: rev.instance_id as number, title: rev.title })} accessibilityLabel={t('teacher.guest_pass_issue')}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 40, borderRadius: radius.md, backgroundColor: colors.brandTint }}>
                <Icon name="add" size={16} color={colors.brand} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.guest_add_short')}</Text>
              </TouchableOpacity>
              </Surface>
            {rev.is_quiz_exam ? (
              <Surface id="teacher.revisions.exam_marks_button">
              <TouchableOpacity onPress={() => router.push({ pathname: '/(teacher)/revision-marks', params: { revisionId: String(rev.id), instanceId: String(rev.instance_id), title: rev.title, maxMark: rev.max_mark != null ? String(rev.max_mark) : '' } })}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 40, borderRadius: radius.md, backgroundColor: colors.accentLight }}>
                <Icon name="grades" size={16} color={colors.accentText} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.accentText }}>{t('teacher.exam_marks')}</Text>
              </TouchableOpacity>
              </Surface>
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <Surface id="screen.teacher.revisions" screen>
    <FormScreen title={t('teacher.revisions_title')} subtitle={t('teacher.revisions_subtitle')} scroll={false}
      right={(
        <>
          {list.length > 0 ? <HeaderCount n={list.length} /> : null}
          <Surface id="teacher.revisions.create_button"><HeaderAction icon="add" onPress={() => router.push('/(teacher)/revision-create')} accessibilityLabel={t('revision_create.title')} /></Surface>
        </>
      )}>
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <Surface id="teacher.revisions.list">
        <FlatList showsVerticalScrollIndicator={false}
          data={list}
          keyExtractor={(r) => String(r.id)}
          renderItem={renderRow}
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="book" title={t('teacher.revisions_empty')} />}
        />
        </Surface>
      )}
      <Surface id="teacher.revisions.guest_pass_modal"><GuestPassModal visible={!!guestFor} revisionId={guestFor?.id ?? null} instanceId={guestFor?.instanceId ?? null} sessionTitle={guestFor?.title} onClose={() => setGuestFor(null)} /></Surface>
    </FormScreen>
    </Surface>
  );
}
