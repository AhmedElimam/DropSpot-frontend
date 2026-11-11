import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { View, Text, ActivityIndicator, RefreshControl, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { useThreadsFeed, useThreadsRealtime } from '@/hooks/useThreads';
import type { Thread } from '@/api/threads';
import { ThreadCard } from './ThreadCard';
import { ThreadFilterChips } from './ThreadFilterChips';
import { InitialsAvatar } from './Avatar';
import { filterCounts, matchesFilter, stateOf, type ThreadFilter } from './format';

const threadKey = (th: Thread) => String(th.id);

function CardGap() {
  return <View style={{ height: spacing.md }} />;
}

/**
 * حكاوي's feed, shared by the student's tab and the teacher's segment. Newest first, with
 * client-side filter chips (open / waiting for the teacher / answered / تكات). A teacher gets
 * a social composer on top and — while their own switch is off — an amber card that says
 * their students see nothing yet. Settings and the reports queue live in the page hero.
 *
 * The posts are the page's ONE vertical scroller, windowed (a FlatList, never a ScrollView of
 * cards): the caller's hero comes in as `header` and scrolls with them, the closing line as
 * `footer`. Never put this inside a ScrollView.
 */
export function ThreadsFeed({ onOpen, onCompose, onSettings, reader, header, footer, overlap = 0, contentContainerStyle, refreshing, onRefresh }: {
  onOpen: (id: number) => void;
  onCompose?: (kind: 'question' | 'note') => void;
  onSettings?: () => void;
  /** A parent's feed (founder 2026-10-15): their wording, read-only. */
  reader?: 'parent';
  /** What scrolls above the feed (the screen's hero). */
  header?: ReactElement | null;
  /** After the last post (the beta note line). */
  footer?: ReactElement | null;
  /** How far the feed rises over the hero's foot. */
  overlap?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Pull-to-refresh (the host's own queries: the feed and its badges). */
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { t } = useTranslation();
  const focused = useIsFocused();
  // The socket's real state slows the poll to a safety net (see useThreadsFeed); the two hooks
  // meet through this flag because the socket needs the feed's own `realtime` settings.
  const [live, setLive] = useState(false);
  const { data, isLoading, isError, refetch } = useThreadsFeed(true, live);
  const channels = useMemo(() => data?.channels ?? [], [data?.channels]);
  const { connected } = useThreadsRealtime(data?.realtime, channels, focused);
  useEffect(() => { setLive(connected); }, [connected]);
  const [filter, setFilter] = useState<ThreadFilter>('all');

  // The cards are memoised; hand them ONE callback for the feed's life, whatever the parent passes.
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const open = useCallback((id: number) => openRef.current(id), []);

  const list = useMemo(() => data?.threads ?? [], [data?.threads]);
  const counts = useMemo(() => filterCounts(list), [list]);
  const shown = useMemo(() => (filter === 'all' ? list : list.filter((th) => matchesFilter(stateOf(th), filter))), [list, filter]);
  // A filter whose last post just went away falls back to everything.
  useEffect(() => { if (filter !== 'all' && counts[filter] === 0) setFilter('all'); }, [counts, filter]);

  const isTeacher = !!data?.settings;
  const isStaff = isTeacher || data?.open_reports !== undefined;
  const isParent = reader === 'parent' || list[0]?.permissions.role === 'parent';
  // A student is told, calmly, that their parents can read حكاوي (founder 2026-10-15).
  const parentsSee = !isStaff && !isParent && list.some((th) => th.parents_can_see && th.permissions.role === 'student');
  const closedByParent = !isStaff && !isParent && data?.participation === 'off';

  const renderItem = useCallback(({ item }: { item: Thread }) => (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <ThreadCard thread={item} onOpen={open} staff={isStaff} />
    </View>
  ), [open, isStaff]);

  const ready = !isLoading && !isError && !(closedByParent && list.length === 0);

  // Everything above the posts: the screen's hero, then this feed's own notes, composer and chips.
  const top = (
    <>
      {header}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: -overlap, gap: spacing.md, paddingBottom: ready && shown.length > 0 ? spacing.md : 0 }}>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl4 }} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !ready ? (
          <ClosedByParent />
        ) : (
          <>
            {isTeacher && data?.settings && !data.settings.enabled ? <OffCard onPress={onSettings} /> : null}

            {parentsSee ? <CalmNote icon="people" text={t('threads.parents_can_see')} /> : null}
            {isParent && list.length > 0 ? <CalmNote icon="shield" text={t('threads.parent_note')} /> : null}

            {isStaff && !isTeacher ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandTint }}>
                <Icon name="shield" size={17} color={colors.brand} />
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 19, color: colors.textPrimary }}>{t('threads.assistant_note')}</Text>
              </View>
            ) : null}

            {isTeacher && onCompose ? (
              <ComposerRow
                teacher={list[0]?.teacher}
                onQuestion={() => onCompose('question')}
                onNote={() => onCompose('note')}
              />
            ) : null}

            {list.length > 0 ? <ThreadFilterChips value={filter} onChange={setFilter} counts={counts} staff={isStaff} bleed={spacing.lg} /> : null}

            {list.length === 0 ? (
              <EmptyFeed teacher={isTeacher} parent={isParent} onCompose={onCompose ? () => onCompose('question') : undefined} />
            ) : shown.length === 0 ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xl }}>
                {t('threads.filter_empty')}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </>
  );

  return (
    <FlatList
      data={ready ? shown : NO_THREADS}
      keyExtractor={threadKey}
      renderItem={renderItem}
      ListHeaderComponent={top}
      ListFooterComponent={footer}
      ItemSeparatorComponent={CardGap}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
      // Fills the viewport, so the pull works on a short or empty feed too (Android).
      contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      initialNumToRender={5}
      maxToRenderPerBatch={5}
      windowSize={7}
    />
  );
}

const NO_THREADS: Thread[] = [];

/** The teacher's «what's on your mind»: one tap to a question, one to a تكة. */
function ComposerRow({ teacher, onQuestion, onNote }: { teacher?: { id: number; name: string }; onQuestion: () => void; onNote: () => void }) {
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);
  const who = teacher ?? (me ? { id: me.id, name: me.name } : { id: 0, name: '' });
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, gap: spacing.md, ...shadows.sm }}>
      <TouchableOpacity onPress={onQuestion} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('threads.compose')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <InitialsAvatar id={who.id} name={who.name} size={42} />
        <View style={{ flex: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary }} numberOfLines={1}>{t('threads.composer_prompt')}</Text>
        </View>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <QuickAction icon="question" label={t('threads.kind_question')} tint={colors.brandTint} ink={colors.brand} onPress={onQuestion} />
        <QuickAction icon="lightbulb" label={t('threads.kind_note')} tint={colors.accentWarmTint} ink={colors.accentText} onPress={onNote} />
      </View>
    </View>
  );
}

function QuickAction({ icon, label, tint, ink, onPress }: { icon: IconName; label: string; tint: string; ink: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.md, backgroundColor: tint }}>
      <Icon name={icon} size={17} color={ink} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: ink }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** The teacher's own switch is off: their students see nothing. Warm, not alarming. */
function OffCard({ onPress }: { onPress?: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.warningLight, borderWidth: 1, borderColor: colors.warning }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="eyeOff" size={19} color={colors.warning} outline />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.warningText }}>{t('threads.settings_off_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.warningText }}>{t('threads.settings_off_banner')}</Text>
      </View>
      {onPress ? (
        <View style={{ paddingHorizontal: spacing.md, height: 32, borderRadius: radius.full, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: '#FFFFFF' }}>{t('threads.settings_off_cta')}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/**
 * Nothing posted yet: three tokens of what حكاوي holds — a question, a tip, the spark of a
 * good answer — leaning on each other, then a line for this reader.
 */
function EmptyFeed({ teacher, parent, onCompose }: { teacher: boolean; parent?: boolean; onCompose?: () => void }) {
  const { t } = useTranslation();
  const bubble = (icon: IconName, bg: string, ink: string, size: number, tilt: string, lift = 0) => (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: tilt }, { translateY: lift }], borderWidth: 3, borderColor: colors.background }}>
      <Icon name={icon} size={size * 0.44} color={ink} />
    </View>
  );
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, borderRadius: radius.xxl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.lg }}>
        {bubble('lightbulb', colors.accentWarm, colors.onAccent, 58, '-10deg', 6)}
        <View style={{ marginHorizontal: -10, zIndex: 1 }}>{bubble('question', colors.brand, colors.onPrimary, 80, '0deg')}</View>
        {bubble('sparkles', colors.success, colors.onPrimary, 54, '12deg', 10)}
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, textAlign: 'center' }}>{teacher ? t('threads.empty_teacher_title') : t('threads.empty_title')}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', marginTop: 6 }}>
        {teacher ? t('threads.empty_teacher') : parent ? t('threads.empty_parent') : t('threads.empty_student')}
      </Text>
      {teacher && onCompose ? (
        <TouchableOpacity onPress={onCompose} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg, paddingHorizontal: spacing.xl, height: 46, borderRadius: radius.full, backgroundColor: colors.brand }}>
          <Icon name="add" size={18} color="#FFFFFF" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: '#FFFFFF' }}>{t('threads.empty_teacher_cta')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** One calm line on the feed's top: who can see, what a parent can do. Never alarming. */
export function CalmNote({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandTint }}>
      <Icon name={icon} size={16} color={colors.brand} outline />
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 19, color: colors.textPrimary }}>{text}</Text>
    </View>
  );
}

/** حكاوي closed for this student by their parent: friendly, no blame, nothing to press. */
export function ClosedByParent() {
  const { t } = useTranslation();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, borderRadius: radius.xxl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight }}>
      <View style={{ width: 76, height: 76, borderRadius: 28, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
        <Icon name="lock" size={32} color={colors.brand} />
        <View style={{ position: 'absolute', bottom: -6, end: -6, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentWarm, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.surface }}>
          <Icon name="people" size={14} color={colors.onAccent} />
        </View>
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center' }}>{t('threads.off_title')}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' }}>{t('threads.off_body')}</Text>
    </View>
  );
}
