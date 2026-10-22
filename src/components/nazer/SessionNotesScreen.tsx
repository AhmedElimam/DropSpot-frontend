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
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Surface } from '@/ui/surfaces';
import { useDialogPersona } from '@/ui/dialog';
import { NazerFace } from './NazerFace';
import { useSessionNotes } from '@/hooks/useSessionNotes';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { dayLabel, formatTime } from '@/utils/format';
import type { SessionNoteEntry } from '@/api/sessionNotes';

/**
 * «ملاحظات الحصص» (founder 2026-10-22): everything a teacher wrote after a session — the note
 * to the whole session and the child's own — kept in الناظر's office for the family to come
 * back to any time. Newest first, a page of sessions at a time; a parent can narrow to one
 * child (`family`, the parent's children). The same screen for a parent and a student.
 */
export function SessionNotesScreen({ who, family = [], initialStudentId }: {
  who: 'parent' | 'student';
  family?: { student_id: string | number; name: string }[];
  initialStudentId?: string | null;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  useDialogPersona('nazer');
  const [childId, setChildId] = useState<string | null>(initialStudentId ?? null);
  const { data, isLoading, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useSessionNotes(who, childId);
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const items = useMemo(() => (data?.pages ?? []).flatMap((p) => p.items), [data]);
  const kids = who === 'parent' ? family : [];
  // Name the child on each card only when the list mixes several.
  const showChild = who === 'parent' && !childId && kids.length > 1;

  return (
    <Surface id={`screen.${who}.session_notes`} screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <NoteCard entry={item} who={who} showChild={showChild} />}
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
            <Surface id={`${who}.session_notes.hero`}>
            <PageHero title={t('session_notes.title')} subtitle={t('session_notes.subtitle')} onBack compact>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, borderRadius: radius.xl, padding: spacing.md }}>
                <NazerFace mood="tender" size={52} blink={false} />
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 21, color: colors.onHero }}>
                  {t(who === 'parent' ? 'session_notes.nazer_parent' : 'session_notes.nazer_student')}
                </Text>
              </View>
            </PageHero>
            </Surface>
            {kids.length > 1 ? (
              <Surface id="parent.session_notes.children">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                {[{ id: null as string | null, name: t('session_notes.all_children') }, ...kids.map((c) => ({ id: String(c.student_id), name: c.name }))].map((c) => {
                  const on = childId === c.id;
                  return (
                    <TouchableOpacity key={c.id ?? 'all'} onPress={() => setChildId(c.id)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
                      style={{ paddingVertical: 7, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.border }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.onPrimary : colors.textSecondary }}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              </Surface>
            ) : null}
            <View style={{ height: spacing.lg }} />
          </View>
        }
        ListEmptyComponent={isLoading
          ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl4 }} />
          : <EmptyState icon="note" title={t('session_notes.empty_title')} message={t('session_notes.empty_body')} />}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : null}
      />
    </View>
    </Surface>
  );
}

function NoteCard({ entry, who, showChild }: { entry: SessionNoteEntry; who: 'parent' | 'student'; showChild: boolean }) {
  const { t } = useTranslation();
  const when = entry.scheduled_at ? `${dayLabel(entry.scheduled_at)} · ${formatTime(entry.scheduled_at)}` : '';
  return (
    <Surface id="family.session_notes.card" ctx={{ entry }}>
    <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="book" size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 22, color: colors.textPrimary }} numberOfLines={2}>{entry.course_name ?? ''}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary }} numberOfLines={1}>
            {[entry.teacher_name ? t('session_notes.teacher', { name: entry.teacher_name }) : null, when].filter(Boolean).join(' · ')}
          </Text>
          {showChild && entry.student_name ? (
            <View style={{ alignSelf: 'flex-start', marginTop: 4, backgroundColor: colors.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary }}>{entry.student_name}</Text>
            </View>
          ) : null}
        </View>
        {entry.status ? <StatusBadge status={entry.status} size="sm" /> : null}
      </View>

      {entry.summary ? (
        <View style={{ marginTop: spacing.md, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textTertiary, marginBottom: 3 }}>{t('session_notes.summary_label')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textPrimary }}>{entry.summary}</Text>
        </View>
      ) : null}

      {entry.note ? (
        <View style={{ marginTop: spacing.sm, backgroundColor: colors.accentLight, borderRadius: radius.lg, padding: spacing.md, borderStartWidth: 3, borderStartColor: colors.accent }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textTertiary, marginBottom: 3 }}>
            {who === 'student' ? t('session_notes.note_label_me') : t('session_notes.note_label_child', { name: entry.student_name ?? '' })}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textPrimary }}>{entry.note}</Text>
        </View>
      ) : null}
    </View>
    </Surface>
  );
}
