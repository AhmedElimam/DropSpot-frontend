import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav } from '@/theme/index';
import { useChatChannels, useChatEnabled } from '@/hooks/useChat';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { PageHero } from '@/components/ui/PageHero';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber, formatShortDate, formatTime, relativeDay } from '@/utils/format';
import type { ChatChannelSummary } from '@/api/chat';
import { roomIdOf, type RoomId } from '@/chat/room';
import { RoomAvatar, roomBadge } from '@/components/chat/RoomAvatar';
import { filterInbox, groupInbox, hasBothAudiences, inboxCounts, sortRooms, type InboxFilter, type InboxGroup } from '@/chat/inbox';

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
  const courses = new Set(list.map((c) => c.course_id)).size;
  const unreadMessages = list.reduce((n, c) => n + (c.unread || 0), 0);


  const title = role === 'parent' ? t('community.title') : role === 'teacher' ? t('chat.conversations') : t('chat.title');
  const subtitle = role === 'parent' ? t('community.tagline') : role === 'teacher' ? t('chat.inbox_teacher_sub') : t('chat.subtitle');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: (onBack ? nav.pageEnd : nav.bottomHeight) + insets.bottom + spacing.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <PageHero
          onBack={onBack}
          title={title}
          subtitle={subtitle}
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

        <View style={{ paddingHorizontal: spacing.lg, marginTop: list.length ? 0 : -spacing.xl }}>
          <ChatInboxList onOpen={onOpen} filter={filter} query={query} />
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * The filter chips: all, unread, and — for someone with both kinds of room — the class and the
 * parents. A parent's own room leads for a parent («أولياء الأمور» then «أبنائي»); the class
 * leads for a teacher. Shared by the conversations page and the in-room switcher.
 */
export function InboxChips({ list, value, onChange }: { list: ChatChannelSummary[]; value: InboxFilter; onChange: (f: InboxFilter) => void }) {
  const { t } = useTranslation();
  const counts = inboxCounts(list);
  const parentView = list.some((c) => c.read_only);
  const chips: { key: InboxFilter; label: string; n: number }[] = [
    { key: 'all', label: t('chat.filter_all'), n: counts.all },
    { key: 'unread', label: t('chat.filter_unread'), n: counts.unread },
    ...(hasBothAudiences(list) ? (parentView
      ? [{ key: 'parents' as const, label: t('chat.filter_parents'), n: counts.parents }, { key: 'students' as const, label: t('chat.filter_children'), n: counts.students }]
      : [{ key: 'students' as const, label: t('chat.filter_students'), n: counts.students }, { key: 'parents' as const, label: t('chat.filter_parents'), n: counts.parents }]) : []),
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 2 }}>
      {chips.map((c) => {
        const on = value === c.key;
        return (
          <TouchableOpacity key={c.key} onPress={() => onChange(c.key)} activeOpacity={0.8}
            accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.border, ...shadows.sm }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: on ? colors.onPrimary : colors.textSecondary }}>{c.label}</Text>
            {c.n > 0 ? (
              <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.22)' : c.key === 'unread' ? colors.success : colors.surfaceSunken }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: on || c.key === 'unread' ? colors.onPrimary : colors.textTertiary }}>{formatNumber(c.n)}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/**
 * The rooms themselves — course cards when this person has both kinds of room, a messenger
 * list otherwise. Also used under the threads segments while threads are on.
 */
export function ChatInboxList({ onOpen, filter = 'all', query = '', current }: {
  onOpen: (room: RoomId) => void;
  filter?: InboxFilter;
  query?: string;
  /** The room you are in (the switcher): marked «أنت هنا», not a link. */
  current?: RoomId;
}) {
  const { t } = useTranslation();
  const enabled = useChatEnabled();
  // Same query key as the host screen's pull-to-refresh, so this is not a second fetch.
  const { data, isLoading } = useChatChannels();
  const all = data ?? [];
  const shown = filterInbox(all, filter, query);
  const grouped = hasBothAudiences(all);

  if (!enabled) return <Empty icon="chat" title={t('common.not_available')} />;
  if (isLoading) return <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl4 }} />;
  if (!all.length) return <Empty icon="chat" title={t('chat.empty_title')} body={t('chat.empty_body')} />;
  if (!shown.length) {
    return query.trim()
      ? <Empty icon="search" title={t('chat.empty_search', { q: query.trim() })} />
      : <Empty icon="check" title={t('chat.empty_unread_title')} body={t('chat.empty_unread_body')} tone="success" />;
  }

  if (grouped) {
    return (
      <View style={{ gap: spacing.md }}>
        {groupInbox(shown).map((g) => <CourseCard key={g.courseId} group={g} onOpen={onOpen} current={current} />)}
      </View>
    );
  }

  const rows = sortRooms(shown);
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadows.sm }}>
      {rows.map((c, i) => <RoomRow key={roomIdOf(c)} room={c} last={i === rows.length - 1} onOpen={onOpen} here={roomIdOf(c) === current} />)}
    </View>
  );
}

/** One course: its name (and, for a parent, which children), then its rooms. */
function CourseCard({ group: g, onOpen, current }: { group: InboxGroup; onOpen: (room: RoomId) => void; current?: RoomId }) {
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
}

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
function RoomRow({ room: c, last, onOpen, here = false }: { room: ChatChannelSummary; last: boolean; onOpen: (room: RoomId) => void; here?: boolean }) {
  const { t } = useTranslation();
  const unread = c.unread > 0 && !here;
  const name = c.course_name ?? '—';
  return (
    <TouchableOpacity onPress={() => onOpen(roomIdOf(c))} disabled={here} activeOpacity={0.6} accessibilityState={{ selected: here }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: here ? colors.brandTint : unread ? colors.surfaceSunken : colors.surface }}>
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
}

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
