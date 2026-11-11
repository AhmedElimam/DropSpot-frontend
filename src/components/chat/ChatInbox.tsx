import { memo, useCallback, useMemo, useState, type ReactElement } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList as PlainFlatList, type StyleProp, type ViewStyle } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav } from '@/theme/index';
import { CHAT_FLAG, useChatChannels, useChatEnabled } from '@/hooks/useChat';
import { BetaChip, BetaLine } from '@/components/ui/Beta';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { PageHero } from '@/components/ui/PageHero';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber, formatShortDate, formatTime, relativeDay } from '@/utils/format';
import type { ChatChannelSummary } from '@/api/chat';
import { roomIdOf, type RoomId } from '@/chat/room';
import { RoomAvatar, roomBadge } from '@/components/chat/RoomAvatar';
import { InboxChips } from '@/components/chat/InboxChips';
import { filterInbox, groupInbox, hasBothAudiences, sortRooms, type InboxFilter, type InboxGroup } from '@/chat/inbox';

export { InboxChips } from '@/components/chat/InboxChips';

export type InboxRole = 'teacher' | 'student' | 'parent';

/**
 * The conversations screen, one design for every party (founder 2026-10-12: «some love on
 * that page of chat list … on all parties, it looks like a mess»).
 *
 * The ink hero with the numbers that matter (rooms, unread), a search once the list is long,
 * filter chips, then the rooms. A course with two rooms (a teacher's or a parent's) is ONE
 * card holding both — «مجموعة الطلاب» and «أولياء الأمور», or a parent's «أولياء الأمور» and
 * the child's room they follow — instead of every course twice in one long list. A student,
 * one room per course, gets a plain messenger list.
 *
 * The page IS the rooms' list (ChatInboxList, windowed): the hero and the chips are its header.
 */
export function ChatInbox({ role, onOpen, onBack }: { role: InboxRole; onOpen: (room: RoomId) => void; onBack?: boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data, refetch } = useChatChannels();
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [query, setQuery] = useState('');

  const list = useMemo(() => data ?? [], [data]);
  const both = hasBothAudiences(list);
  const courses = useMemo(() => { const ids = new Set<number>(); for (const c of list) ids.add(c.course_id); return ids.size; }, [list]);
  const unreadMessages = list.reduce((n, c) => n + (c.unread || 0), 0);

  const title = role === 'parent' ? t('community.title') : role === 'teacher' ? t('chat.conversations') : t('chat.title');
  const subtitle = role === 'parent' ? t('community.tagline') : role === 'teacher' ? t('chat.inbox_teacher_sub') : t('chat.subtitle');

  const header = (
    <>
      <PageHero
        onBack={onBack}
        title={title}
        subtitle={subtitle}
        badge={<BetaChip feature={CHAT_FLAG} />}
        stats={list.length ? [
          { value: formatNumber(both ? courses : list.length), label: both ? t('chat.stat_courses') : t('chat.stat_rooms') },
          { value: formatNumber(unreadMessages), label: t('chat.stat_unread'), warn: unreadMessages > 0 },
        ] : undefined}
      >
        {list.length > 5 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, height: 46, borderRadius: radius.lg, paddingHorizontal: spacing.md, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder }}>
            <Icon name="search" size={18} color={colors.onHeroSoft} outline />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('chat.inbox_search')}
              placeholderTextColor={colors.onHeroSoft}
              returnKeyType="search"
              style={{ flex: 1, height: 46, fontFamily: fonts.regular, fontSize: 15, color: colors.onHero, textAlign: 'right' }}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
                <Icon name="close" size={16} color={colors.onHeroSoft} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </PageHero>

      {list.length ? (
        <View style={{ marginTop: -(spacing.xl4 - spacing.sm), paddingBottom: spacing.md }}>
          <InboxChips list={list} value={filter} onChange={setFilter} />
        </View>
      ) : null}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ChatInboxList
        onOpen={onOpen}
        filter={filter}
        query={query}
        header={header}
        overlap={list.length ? 0 : spacing.xl}
        // The note line closes the screen — after the rooms, never above them.
        footer={<BetaLine feature={CHAT_FLAG} />}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: (onBack ? nav.pageEnd : nav.bottomHeight) + insets.bottom + spacing.lg }}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    </View>
  );
}

/** One row of the list: a course's card (someone with both kinds of room), or one room of the messenger list. */
type InboxRow =
  | { kind: 'course'; key: string; group: InboxGroup }
  | { kind: 'room'; key: string; room: ChatChannelSummary; first: boolean; last: boolean };

/**
 * The rooms themselves — course cards when this person has both kinds of room, a messenger
 * list otherwise. A windowed list (rooms come from the server, and a teacher has two per
 * course): it is the page's ONE vertical scroller, so the caller's hero and chips come in as
 * `header` and scroll with the rooms, and the closing line as `footer`. Never put it inside a
 * ScrollView. Under the hub's segments, on the conversations page and in the room switcher.
 */
export function ChatInboxList({ onOpen, filter = 'all', query = '', current, header, footer, overlap = 0, inset = spacing.lg, style, contentContainerStyle, refreshing, onRefresh }: {
  onOpen: (room: RoomId) => void;
  filter?: InboxFilter;
  query?: string;
  /** The room you are in (the switcher): marked «أنت هنا», not a link. */
  current?: RoomId;
  /** What scrolls above the rooms (the hero, the chips). */
  header?: ReactElement | null;
  /** After the last room (the beta note line). */
  footer?: ReactElement | null;
  /** How far the first room rises over the header's foot (the hero's overlap). */
  overlap?: number;
  /** The rooms' side gutter. */
  inset?: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Pull-to-refresh, when the list is a page (the host's own queries). */
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { t } = useTranslation();
  const enabled = useChatEnabled();
  // Same query key as the host screen's pull-to-refresh, so this is not a second fetch.
  const { data, isLoading } = useChatChannels();
  const all = useMemo(() => data ?? [], [data]);
  const shown = useMemo(() => filterInbox(all, filter, query), [all, filter, query]);
  const grouped = hasBothAudiences(all);

  const rows = useMemo<InboxRow[]>(() => {
    if (!enabled) return [];
    const out: InboxRow[] = [];
    if (grouped) {
      for (const g of groupInbox(shown)) out.push({ kind: 'course', key: `c-${g.courseId}`, group: g });
      return out;
    }
    const sorted = sortRooms(shown);
    sorted.forEach((room, i) => out.push({ kind: 'room', key: `r-${roomIdOf(room)}`, room, first: i === 0, last: i === sorted.length - 1 }));
    return out;
  }, [enabled, grouped, shown]);

  const renderItem = useCallback(({ item }: { item: InboxRow }) => (
    <View style={{ paddingHorizontal: inset }}>
      {item.kind === 'course'
        ? <CourseCard group={item.group} onOpen={onOpen} current={current} />
        : <RoomRow room={item.room} first={item.first} last={item.last} onOpen={onOpen} here={roomIdOf(item.room) === current} />}
    </View>
  ), [inset, onOpen, current]);

  const empty = (
    <View style={{ paddingHorizontal: inset }}>
      {!enabled ? <Empty icon="chat" title={t('common.not_available')} />
        : isLoading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl4 }} />
          : !all.length ? <Empty icon="chat" title={t('chat.empty_title')} body={t('chat.empty_body')} />
            : query.trim()
              ? <Empty icon="search" title={t('chat.empty_search', { q: query.trim() })} />
              : <Empty icon="check" title={t('chat.empty_unread_title')} body={t('chat.empty_unread_body')} tone="success" />}
    </View>
  );

  // The app's list (floating pull-to-refresh, drives the tab bar) when it is a page; the plain
  // one inside a sheet, which has neither.
  const List = onRefresh ? FlatList : PlainFlatList;
  return (
    <List
      data={rows}
      keyExtractor={rowKey}
      renderItem={renderItem}
      ListHeaderComponent={header || overlap ? <View style={{ marginBottom: -overlap }}>{header}</View> : null}
      ListEmptyComponent={empty}
      ListFooterComponent={footer}
      ItemSeparatorComponent={grouped ? CardGap : null}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
      style={style}
      // A page fills the viewport, so the pull works on a short or empty list too (Android).
      contentContainerStyle={[onRefresh ? { flexGrow: 1 } : null, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={10}
      maxToRenderPerBatch={8}
      windowSize={9}
    />
  );
}

const rowKey = (r: InboxRow) => r.key;

function CardGap() {
  return <View style={{ height: spacing.md }} />;
}

/** One course: its name (and, for a parent, which children), then its rooms. */
const CourseCard = memo(function CourseCard({ group: g, onOpen, current }: { group: InboxGroup; onOpen: (room: RoomId) => void; current?: RoomId }) {
  const { t } = useTranslation();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: g.unread > 0 ? colors.brand + '40' : colors.border, overflow: 'hidden', ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="book" size={17} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16.5, color: colors.textPrimary, textAlign: 'right' }} numberOfLines={1}>{g.name}</Text>
          {g.children.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
              {g.children.map((k) => (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.brandTint, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
                  <Icon name="child" size={11} color={colors.brand} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.brand }}>{k}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, textAlign: 'right' }}>
              {stamp(g.lastAt ? new Date(g.lastAt).toISOString() : null) || t('chat.no_preview')}
            </Text>
          )}
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, gap: 2 }}>
        {g.rooms.map((c) => <RoomLine key={roomIdOf(c)} room={c} onOpen={onOpen} here={roomIdOf(c) === current} />)}
      </View>
    </View>
  );
});

/** A room inside a course card: what room it is, its last line, its time and unread. */
function RoomLine({ room: c, onOpen, here = false }: { room: ChatChannelSummary; onOpen: (room: RoomId) => void; here?: boolean }) {
  const { t } = useTranslation();
  const parents = c.audience === 'parents';
  const unread = c.unread > 0 && !here;
  const label = parents
    ? t('chat.room_parents')
    : c.read_only
      ? t('chat.room_following', { names: (c.children ?? []).join('، ') })
      : t('chat.room_students');

  return (
    <TouchableOpacity onPress={() => onOpen(roomIdOf(c))} disabled={here} activeOpacity={0.6}
      accessibilityRole="button" accessibilityState={{ selected: here }} accessibilityLabel={`${label} — ${c.course_name ?? ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: here ? colors.brandTint : unread ? colors.surfaceSunken : 'transparent' }}>
      <RoomAvatar room={roomIdOf(c)} size={44} badge={roomBadge(c)} label={label} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }} numberOfLines={1}>{label}</Text>
          {c.read_only ? (
            <View style={{ backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 0 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: colors.textTertiary }}>{t('chat.read_only_pill')}</Text>
            </View>
          ) : null}
          {here ? <HerePill /> : null}
          <View style={{ flex: 1 }} />
          <Text style={{ fontFamily: unread ? fonts.bold : fonts.regular, fontSize: 11.5, color: unread ? colors.success : colors.textTertiary }}>{stamp(c.last_message_at)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={{ flex: 1, fontFamily: unread ? fonts.medium : fonts.regular, fontSize: 13.5, color: unread ? colors.textSecondary : colors.textTertiary, textAlign: 'right' }} numberOfLines={1}>
            {previewOf(c, t)}
          </Text>
          <Marks room={c} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** A student's room: the course is the room, so the row is the messenger row. */
const RoomRow = memo(function RoomRow({ room: c, first, last, onOpen, here = false }: { room: ChatChannelSummary; first: boolean; last: boolean; onOpen: (room: RoomId) => void; here?: boolean }) {
  const { t } = useTranslation();
  const unread = c.unread > 0 && !here;
  const name = c.course_name ?? '—';
  return (
    <TouchableOpacity onPress={() => onOpen(roomIdOf(c))} disabled={here} activeOpacity={0.6} accessibilityState={{ selected: here }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: here ? colors.brandTint : unread ? colors.surfaceSunken : colors.surface,
        // The rows of one list read as ONE card: each row carries its sides, the first its
        // top and the last its foot (the rows are windowed, so no wrapper holds them all).
        overflow: 'hidden', borderColor: colors.border, borderLeftWidth: 1, borderRightWidth: 1,
        borderTopWidth: first ? 1 : 0, borderTopLeftRadius: first ? radius.xl : 0, borderTopRightRadius: first ? radius.xl : 0,
        borderBottomWidth: last ? 1 : 0, borderBottomLeftRadius: last ? radius.xl : 0, borderBottomRightRadius: last ? radius.xl : 0,
      }}>
      <RoomAvatar room={roomIdOf(c)} size={52} label={name} />
      <View style={{ flex: 1, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.borderLight, paddingBottom: spacing.md, marginBottom: -spacing.md, paddingTop: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 16.5, color: colors.textPrimary, textAlign: 'right' }} numberOfLines={1}>{name}</Text>
          {here ? <HerePill /> : null}
          <View style={{ flex: 1 }} />
          <Text style={{ fontFamily: unread ? fonts.bold : fonts.regular, fontSize: 12, color: unread ? colors.success : colors.textTertiary }}>{stamp(c.last_message_at)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 }}>
          <Text style={{ flex: 1, fontFamily: unread ? fonts.medium : fonts.regular, fontSize: 14, color: unread ? colors.textSecondary : colors.textTertiary, textAlign: 'right' }} numberOfLines={1}>
            {previewOf(c, t)}
          </Text>
          <Marks room={c} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

/** «أنت هنا» — the room the switcher was opened from. */
function HerePill() {
  const { t } = useTranslation();
  return (
    <View style={{ backgroundColor: colors.brand, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 1 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: colors.onPrimary }}>{t('chat.switch_here')}</Text>
    </View>
  );
}

/** Silenced, locked, announcements, unread — the small marks at the end of a preview line. */
function Marks({ room: c }: { room: ChatChannelSummary }) {
  return (
    <>
      {!c.notify ? <Icon name="bellOff" size={14} color={colors.textTertiary} outline /> : null}
      {c.locked ? <Icon name="lock" size={13} color={colors.textTertiary} /> : null}
      {c.announcements_only ? <Icon name="info" size={13} color={colors.textTertiary} outline /> : null}
      {c.unread > 0 ? (
        <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.onPrimary }}>{c.unread > 99 ? '99+' : formatNumber(c.unread)}</Text>
        </View>
      ) : null}
    </>
  );
}

function Empty({ icon, title, body, tone }: { icon: IconName; title: string; body?: string; tone?: 'success' }) {
  return (
    <View style={{ alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, ...shadows.sm }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: tone === 'success' ? colors.successLight : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={28} color={tone === 'success' ? colors.success : colors.brand} outline />
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }}>{title}</Text>
      {body ? <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.textTertiary, marginTop: 4, textAlign: 'center' }}>{body}</Text> : null}
    </View>
  );
}

/** Who said it, then what — the two halves of a messenger preview line. */
function previewOf(c: ChatChannelSummary, t: (k: string) => string): string {
  if (!c.last_preview) return t('chat.no_preview');
  const who = c.last_mine ? t('chat.you') : (c.last_sender ?? '');
  return who ? `${who}: ${c.last_preview}` : c.last_preview;
}

/** Time for today, «أمس» for yesterday, a short date beyond — the messenger convention. */
function stamp(iso: string | null): string {
  if (!iso) return '';
  const rel = relativeDay(iso);
  if (rel === 'اليوم') return formatTime(iso);
  if (rel) return rel;
  return formatShortDate(iso);
}
