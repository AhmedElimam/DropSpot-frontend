import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { PageHero } from '@/components/ui/PageHero';
import { EmptyState } from '@/components/ui/EmptyState';
import { Surface } from '@/ui/surfaces';
import { useDialogPersona } from '@/ui/dialog';
import { HomeworkRatingBadge, HomeworkSummaryRow } from './HomeworkChips';
import { useHomework } from '@/hooks/useHomework';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { dayLabel } from '@/utils/format';
import { homeworkDay, type HomeworkEntry } from '@/api/homework';

/**
 * «الواجبات» (founder 2026-11-03): every homework a teacher gave, and how it was done — جيد،
 * مقبول، ضعيف، لم يحلّ — graded at the next session. On top the completion rate over all of it.
 * Newest first, a page at a time; a parent can narrow to one child (`family`). The same
 * screen for a parent and a student, built like «ملاحظات الحصص».
 */
export function HomeworkScreen({ who, family = [], initialStudentId }: {
  who: 'parent' | 'student';
  family?: { student_id: string | number; name: string }[];
  initialStudentId?: string | null;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  useDialogPersona('nazer');
  const [childId, setChildId] = useState<string | null>(initialStudentId ?? null);
  const { data, isLoading, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useHomework(who, childId);
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const items = useMemo(() => (data?.pages ?? []).flatMap((p) => p.items), [data]);
  const summary = data?.pages[0]?.summary ?? null;
  const kids = who === 'parent' ? family : [];
  // Name the child on each card only when the list mixes several.
  const showChild = who === 'parent' && !childId && kids.length > 1;

  return (
    <Surface id={`screen.${who}.homework`} screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <HomeworkCard entry={item} showChild={showChild} />}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: nav.pageEnd + insets.bottom, flexGrow: 1 }}
        ListHeaderComponent={
          <View>
            <Surface id={`${who}.homework.hero`}>
            <PageHero title={t('homework.title')} subtitle={t(who === 'parent' ? 'homework.subtitle_parent' : 'homework.subtitle_student')} onBack compact />
            </Surface>
            {kids.length > 1 ? (
              <Surface id="parent.homework.children">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                {[{ id: null as string | null, name: t('session_notes.all_children') }, ...kids.map((c) => ({ id: String(c.student_id), name: c.name }))].map((c) => {
                  const on = childId === c.id;
                  return (
                    <TouchableOpacity key={c.id ?? 'all'} onPress={() => setChildId(c.id)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
                      style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.border }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: on ? colors.onPrimary : colors.textSecondary }}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              </Surface>
            ) : null}
            {summary && (summary.graded > 0 || items.length > 0) ? (
              <Surface id={`${who}.homework.summary`}>
              <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadows.sm }}>
                <HomeworkSummaryRow summary={summary} />
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: spacing.sm }}>{t('homework.summary_hint')}</Text>
              </View>
              </Surface>
            ) : null}
            <View style={{ height: spacing.lg }} />
          </View>
        }
        ListEmptyComponent={isLoading
          ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl4 }} />
          : <EmptyState icon="list" title={t('homework.empty_title')} message={t('homework.empty_body')} />}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : null}
      />
    </View>
    </Surface>
  );
}

function HomeworkCard({ entry, showChild }: { entry: HomeworkEntry; showChild: boolean }) {
  const { t } = useTranslation();
  return (
    <Surface id="family.homework.card" ctx={{ entry }}>
    <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="list" size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 24, color: colors.textPrimary }} numberOfLines={2}>{entry.course_name ?? ''}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }} numberOfLines={2}>
            {[entry.teacher_name ? t('session_notes.teacher', { name: entry.teacher_name }) : null, entry.assigned_on ? dayLabel(homeworkDay(entry.assigned_on)) : null].filter(Boolean).join(' · ')}
          </Text>
          {showChild && entry.student_name ? (
            <View style={{ alignSelf: 'flex-start', marginTop: 4, backgroundColor: colors.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary }}>{entry.student_name}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ marginTop: spacing.md, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textTertiary, marginBottom: 3 }}>{t('homework.body_label')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, color: colors.textPrimary }}>{entry.body}</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('homework.result_label')}</Text>
        <HomeworkRatingBadge rating={entry.rating} big />
      </View>
    </View>
    </Surface>
  );
}
