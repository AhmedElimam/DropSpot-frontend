import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, TextInput, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { chat, senderColor } from '@/theme/chat';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  useChatCalendar, useChatInfo, useChatMedia, useChatReports, useBlockChatUser, useMuteChatUser, useSetChatNotify,
  useSetChatSettings, useUnblockChatUser, useUnmuteChatUser,
} from '@/hooks/useChat';
import { attachmentHeaders, type ChatMediaType, type ChatMember, type ChatMessage } from '@/api/chat';
import { useChatJump } from '@/chat/jumpStore';
import { isParentsRoom } from '@/chat/room';
import { chunk, fromYmd, groupByMonth, lastDays, ymd } from '@/chat/roomView';
import { ChatCalendarSheet } from '@/components/chat/ChatCalendarSheet';
import { ChatReportsSheet } from '@/components/chat/ChatReportsSheet';
import { MuteSheet } from '@/components/chat/MuteSheet';
import { ImageViewer } from '@/components/chat/ImageViewer';
import { FilePreview, canPreviewInApp } from '@/components/chat/FilePreview';
import { VoiceNote } from '@/components/chat/VoiceNote';
import { docType, fileSizeLabel } from '@/components/chat/DocumentCard';
import { openFile } from '@/components/chat/AttachmentBubble';
import { domainOf, firstLink, openLink } from '@/components/chat/linkify';
import { formatDateOnly, formatDateTime, formatNumber, foldForSearch, timeAgo } from '@/utils/format';
import { getFriendlyErrorMessage } from '@/utils/errors';

type Tab = 'members' | ChatMediaType;

type Row =
  | { type: 'section'; key: string; title: string }
  | { type: 'member'; key: string; member: ChatMember }
  | { type: 'photos'; key: string; items: ChatMessage[] }
  | { type: 'file' | 'voice' | 'link'; key: string; item: ChatMessage }
  | { type: 'empty'; key: string; text: string };

const TAB_ICON: Record<Tab, IconName> = { members: 'people', media: 'image', files: 'attach', voice: 'mic', links: 'link' };

/**
 * A room's own page — what tapping its name opens (founder 2026-10-12: «clicking on the group
 * title shows media and members' names and flags the moderators … be creative»).
 *
 *  - The room at a glance: its name and teacher, how many members and moderators, since when.
 *  - What you can do here, one tap each: notifications, «go to a day», and — for a moderator —
 *    the report queue and the room's switches.
 *  - Thirty days of the room's life as a strip of bars; tap a day to open the room there.
 *  - The members, moderators first and flagged. A moderator also sees, per student: a mute
 *    (lift it from here), open reports, how much they wrote, when they last read. A student
 *    sees whom they have hidden, and can bring them back.
 *  - The shelf: photos in a grid, files with their badge, voice notes that play right here,
 *    links with their site — month by month, and any of them «show in chat».
 *
 * Every switch here is the same server call the room uses, refused the same way.
 */
export function ChatRoomInfoScreen({ courseId }: { courseId: number }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const info = useChatInfo(courseId);
  const data = info.data;
  const moderator = !!data?.is_moderator;
  // A parent following a child's room reads it; blocking members there is not theirs to do.
  const observer = data?.role === 'observer';
  const parentsRoom = isParentsRoom(courseId);
  const [tab, setTab] = useState<Tab>('members');
  const [search, setSearch] = useState('');
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [muting, setMuting] = useState<{ id: number; name: string } | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [preview, setPreview] = useState<ChatMessage | null>(null);

  useEffect(() => { let alive = true; attachmentHeaders().then((h) => { if (alive) setHeaders(h); }); return () => { alive = false; }; }, []);

  const shelfType: ChatMediaType = tab === 'members' ? 'media' : tab;
  const shelf = useChatMedia(courseId, shelfType, tab !== 'members');
  const items = useMemo(() => (shelf.data?.pages ?? []).flatMap((p) => p.items), [shelf.data]);
  const photos = tab === 'media' ? items : [];

  const today = new Date();
  const from30 = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29));
  const activity = useChatCalendar(courseId, from30, ymd(today));
  const strip = useMemo(() => lastDays(activity.data?.days ?? {}, 30, today), [activity.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const stripMax = Math.max(0, ...strip.map((d) => d.count));
  const stripTotal = strip.reduce((n, d) => n + d.count, 0);
  const busiest = stripMax > 0 ? strip.reduce((a, b) => (b.count > a.count ? b : a)) : null;

  const setNotify = useSetChatNotify(courseId);
  const setSettings = useSetChatSettings(courseId);
  const reports = useChatReports(courseId, moderator);
  const mute = useMuteChatUser(courseId);
  const unmute = useUnmuteChatUser(courseId);
  const block = useBlockChatUser(courseId);
  const unblock = useUnblockChatUser(courseId);

  const jump = (j: { messageId?: number; date?: string }) => {
    useChatJump.getState().requestJump({ courseId, ...j });
    router.back();
  };

  // ── Members ────────────────────────────────────────────────────────────────────────
  const onMember = (m: ChatMember) => {
    if (m.is_you || m.is_moderator || observer) return;
    if (moderator) {
      const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
      if (m.mute) {
        buttons.push({
          text: t('chat.unmute_action'),
          onPress: () => unmute.mutate(m.mute!.id, { onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }),
        });
      } else {
        buttons.push({ text: t('chat.mute_writing'), onPress: () => setMuting({ id: m.id, name: m.name }) });
      }
      buttons.push({ text: t('common.cancel'), style: 'cancel' });
      Alert.alert(m.name, m.mute ? t('chat.muted_until', { time: formatDateTime(m.mute.until) }) : undefined, buttons);
      return;
    }
    if (m.hidden_by_you) {
      Alert.alert(m.name, t('chat.unhide_confirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('chat.unhide_action'), onPress: () => unblock.mutate(m.id, { onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }) },
      ]);
    } else {
      Alert.alert(t('chat.block_confirm_title', { name: m.name }), t('chat.block_confirm_body'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('chat.block_action'), style: 'destructive', onPress: () => block.mutate(m.id, { onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }) },
      ]);
    }
  };

  const roomSwitches = () => {
    if (!data) return;
    Alert.alert(t('chat.room_settings'), t('chat.room_settings_hint'), [
      { text: data.locked ? t('chat.unlock_room') : t('chat.lock_room'), onPress: () => setSettings.mutate({ is_locked: !data.locked }, { onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }) },
      { text: data.announcements_only ? t('chat.announcements_off') : t('chat.announcements_on'), onPress: () => setSettings.mutate({ announcements_only: !data.announcements_only }, { onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  // ── Rows for the active tab ────────────────────────────────────────────────────────
  const gap = 4;
  const cell = Math.floor((width - spacing.lg * 2 - gap * 2) / 3);
  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    if (tab === 'members') {
      const q = foldForSearch(search);
      const list = q ? data.members.filter((m) => foldForSearch(m.name).includes(q)) : data.members;
      const mods = list.filter((m) => m.is_moderator);
      const students = list.filter((m) => !m.is_moderator);
      const out: Row[] = [];
      if (mods.length) out.push({ type: 'section', key: 's-mods', title: `${t('chat.moderators')} · ${formatNumber(mods.length)}` });
      mods.forEach((m) => out.push({ type: 'member', key: `m-${m.id}`, member: m }));
      if (students.length) out.push({ type: 'section', key: 's-students', title: `${parentsRoom ? t('chat.parents') : t('chat.students')} · ${formatNumber(students.length)}` });
      students.forEach((m) => out.push({ type: 'member', key: `m-${m.id}`, member: m }));
      if (!out.length) out.push({ type: 'empty', key: 'e', text: t('chat.members_none_match') });
      return out;
    }
    if (shelf.isLoading) return [];
    if (!items.length) return [{ type: 'empty', key: 'e', text: t(`chat.shelf_empty_${tab}`) }];
    const out: Row[] = [];
    for (const g of groupByMonth(items)) {
      out.push({ type: 'section', key: `s-${g.key}`, title: `${formatDateOnly(g.first, { month: 'long', year: 'numeric' })} · ${formatNumber(g.items.length)}` });
      if (tab === 'media') chunk(g.items, 3).forEach((r, i) => out.push({ type: 'photos', key: `p-${g.key}-${i}`, items: r }));
      else g.items.forEach((it) => out.push({ type: tab === 'files' ? 'file' : tab === 'voice' ? 'voice' : 'link', key: `i-${it.id}`, item: it }));
    }
    return out;
  }, [data, tab, search, items, shelf.isLoading, t]);

  if (info.isLoading && !data) {
    return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (!data) {
    return <View style={{ flex: 1, backgroundColor: colors.background }}><ErrorState onRetry={() => info.refetch()} /></View>;
  }

  const counts = data.counts;
  const tabs: { key: Tab; label: string; n: number }[] = [
    { key: 'members', label: t('chat.tab_members'), n: counts.members },
    { key: 'media', label: t('chat.tab_media'), n: counts.media },
    { key: 'files', label: t('chat.tab_files'), n: counts.files },
    { key: 'voice', label: t('chat.tab_voice'), n: counts.voice },
    { key: 'links', label: t('chat.tab_links'), n: counts.links },
  ];
  const actions: { key: string; icon: IconName; label: string; sub?: string; badge?: number; tone?: string; onPress: () => void }[] = [
    { key: 'notify', icon: data.notify ? 'bell' : 'bellOff', label: t('chat.info_notify'), sub: data.notify ? t('chat.info_on') : t('chat.info_off'), onPress: () => setNotify.mutate(!data.notify) },
    { key: 'date', icon: 'calendar', label: t('chat.jump_to_date'), onPress: () => setCalendarOpen(true) },
    ...(moderator
      ? [
        { key: 'reports', icon: 'flag' as IconName, label: t('chat.reports_title'), badge: data.open_reports ?? 0, tone: (data.open_reports ?? 0) > 0 ? colors.danger : undefined, onPress: () => setReportsOpen(true) },
        { key: 'settings', icon: 'settings' as IconName, label: t('chat.room_settings_short'), sub: data.locked ? t('chat.locked_short') : data.announcements_only ? t('chat.announcements_short') : t('chat.open_short'), onPress: roomSwitches },
      ]
      : [{ key: 'media', icon: 'image' as IconName, label: t('chat.tab_media'), sub: formatNumber(counts.media), onPress: () => setTab('media') }]),
  ];

  const header = (
    <View>
      {/* The room at a glance, on the ink hero every screen wears. */}
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: insets.top + spacing.sm, paddingBottom: spacing.xl4, paddingHorizontal: spacing.lg, alignItems: 'center' }}>
        <View style={{ alignSelf: 'stretch', flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={{ width: 40, height: 44, justifyContent: 'center' }}>
            <Icon name="forward" size={26} color={colors.onHero} />
          </TouchableOpacity>
        </View>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: senderColor(courseId), alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.onHeroChipBorder, ...shadows.md }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 36, color: colors.onPrimary }}>{(data.course.name || '؟').trim().charAt(0)}</Text>
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: colors.onHero, marginTop: spacing.md, textAlign: 'center' }} numberOfLines={2}>
          {parentsRoom ? t('chat.parents_room_name', { course: data.course.name }) : data.course.name}
        </Text>
        {data.course.teacher_name ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.onHeroSoft, marginTop: 2 }}>{t('chat.info_teacher', { name: data.course.teacher_name })}</Text>
        ) : null}
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.onHeroSoft, marginTop: 6 }}>
          {[t('chat.info_members', { n: formatNumber(counts.members) }), t('chat.info_moderators', { n: formatNumber(counts.moderators) }),
            data.first_message_at ? t('chat.info_since', { date: formatDateOnly(data.first_message_at, { month: 'long', year: 'numeric' }) }) : null].filter(Boolean).join(' · ')}
        </Text>
        {/* Who reads this room besides its members — said plainly, on its own page. */}
        {parentsRoom || data.followed_by_parents ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, maxWidth: '100%' }}>
            <Icon name={parentsRoom ? 'children' : 'eye'} size={13} color={colors.onHeroSoft} outline />
            <Text style={{ flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.onHeroSoft, textAlign: 'center' }}>
              {parentsRoom ? t('chat.notice_parents_room') : observer ? t('chat.notice_following') : t('chat.notice_parents_follow')}
            </Text>
          </View>
        ) : null}
        {data.locked || data.announcements_only ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, backgroundColor: colors.onHeroChip, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
            <Icon name={data.locked ? 'lock' : 'info'} size={13} color={colors.onHero} outline />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.onHero }}>{data.locked ? t('chat.locked') : t('chat.announcements')}</Text>
          </View>
        ) : null}
      </LinearGradient>

      {/* One tap each. */}
      <View style={{ flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: -(spacing.xl4 - spacing.md), backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, ...shadows.md }}>
        {actions.map((a) => (
          <TouchableOpacity key={a.key} onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.sub ? `${a.label} — ${a.sub}` : a.label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: a.tone ? colors.dangerLight : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={a.icon} size={21} color={a.tone ?? colors.brand} outline />
              {a.badge ? (
                <View style={{ position: 'absolute', top: -3, end: -3, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 9.5, color: '#fff' }}>{a.badge > 9 ? '9+' : a.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.textPrimary }} numberOfLines={1}>{a.label}</Text>
            {a.sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 10.5, color: colors.textTertiary }} numberOfLines={1}>{a.sub}</Text> : null}
          </TouchableOpacity>
        ))}
      </View>

      {/* Thirty days of the room, oldest at the start. Tap a day to open the room there. */}
      <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('chat.activity_title')}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{stripTotal > 0 ? t('chat.activity_total', { n: formatNumber(stripTotal) }) : t('chat.activity_none')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 52, gap: 2, marginTop: spacing.sm }}>
          {strip.map((d) => (
            <TouchableOpacity key={d.date} disabled={d.count === 0} onPress={() => jump({ date: d.date })} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
              accessibilityLabel={`${formatDateOnly(fromYmd(d.date), { day: 'numeric', month: 'long' })}: ${formatNumber(d.count)}`}>
              <View style={{ height: d.count === 0 ? 3 : Math.max(6, Math.round((d.count / Math.max(1, stripMax)) * 50)), borderRadius: 3, backgroundColor: d.count === 0 ? colors.border : busiest && d.date === busiest.date ? colors.accent : colors.brand, opacity: d.count === 0 ? 1 : 0.85 }} />
            </TouchableOpacity>
          ))}
        </View>
        {busiest ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'right' }}>
            {t('chat.activity_busiest', { day: formatDateOnly(fromYmd(busiest.date), { weekday: 'long', day: 'numeric', month: 'long' }), n: formatNumber(busiest.count) })}
          </Text>
        ) : null}
      </View>

      {/* The tabs: members, then the shelf. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
        {tabs.map((x) => {
          const on = tab === x.key;
          return (
            <TouchableOpacity key={x.key} onPress={() => setTab(x.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.border }}>
              <Icon name={TAB_ICON[x.key]} size={15} color={on ? '#fff' : colors.textSecondary} outline={!on} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? '#fff' : colors.textSecondary }}>{x.label}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: on ? 'rgba(255,255,255,0.8)' : colors.textTertiary }}>{formatNumber(x.n)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tab === 'members' && data.members.length > 10 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.xs, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}>
          <Icon name="search" size={17} color={colors.textTertiary} outline />
          <TextInput value={search} onChangeText={setSearch} placeholder={t('chat.search_members')} placeholderTextColor={colors.textTertiary}
            style={{ flex: 1, height: 44, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }} />
        </View>
      ) : null}
    </View>
  );

  const renderRow = ({ item: r }: { item: Row }) => {
    switch (r.type) {
      case 'section':
        return <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.md, marginBottom: spacing.sm, marginHorizontal: spacing.lg, textAlign: 'right' }}>{r.title}</Text>;
      case 'empty':
        return <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xl, marginHorizontal: spacing.xl }}>{r.text}</Text>;
      case 'member':
        return <MemberRow m={r.member} viewerIsModerator={moderator} readOnly={observer} onPress={() => onMember(r.member)} />;
      case 'photos':
        return (
          <View style={{ flexDirection: 'row', gap, marginHorizontal: spacing.lg, marginBottom: gap }}>
            {r.items.map((p) => (
              <TouchableOpacity key={p.id} activeOpacity={0.85} onPress={() => setViewer(photos.findIndex((x) => x.id === p.id))} onLongPress={() => jump({ messageId: p.id })}
                accessibilityRole="imagebutton" accessibilityLabel={p.attachment?.name ?? t('chat.photo')}>
                {headers && (p.attachment?.thumb_url || p.attachment?.url) ? (
                  <Image source={{ uri: (p.attachment?.thumb_url ?? p.attachment?.url) as string, headers }} style={{ width: cell, height: cell, borderRadius: radius.sm, backgroundColor: colors.surfaceSunken }} contentFit="cover" transition={120} recyclingKey={String(p.id)} />
                ) : <View style={{ width: cell, height: cell, borderRadius: radius.sm, backgroundColor: colors.surfaceSunken }} />}
              </TouchableOpacity>
            ))}
          </View>
        );
      case 'file': {
        const a = r.item.attachment;
        const type = docType(a?.name, a?.mime);
        return (
          <ShelfRow item={r.item} onShowInChat={() => jump({ messageId: r.item.id })}
            onPress={() => { if (!a || !headers) return; if (canPreviewInApp(a.mime)) setPreview(r.item); else void openFile(a, headers, t); }}
            leading={<View style={{ width: 40, height: 46, borderRadius: 7, backgroundColor: type.color, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}><Text style={{ fontFamily: fonts.bold, fontSize: type.label.length > 3 ? 8.5 : 10, color: '#fff' }}>{type.label}</Text></View>}
            title={a?.name ?? t('chat.file')}
            sub={[fileSizeLabel(a?.size), formatDateOnly(r.item.created_at, { day: 'numeric', month: 'short' }), r.item.sender.name].filter(Boolean).join(' · ')} />
        );
      }
      case 'voice':
        return (
          <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm }}>
            {headers && r.item.attachment?.url ? <VoiceNote url={r.item.attachment.url} headers={headers} duration={r.item.attachment.duration ?? 0} mine={false} seed={r.item.id} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, textAlign: 'right' }} numberOfLines={1}>
                {`${r.item.sender.name} · ${formatDateOnly(r.item.created_at, { day: 'numeric', month: 'short' })}`}
              </Text>
              <ShowInChatButton onPress={() => jump({ messageId: r.item.id })} />
            </View>
          </View>
        );
      case 'link': {
        const raw = firstLink(r.item.body) ?? '';
        const domain = domainOf(raw);
        return (
          <ShelfRow item={r.item} onShowInChat={() => jump({ messageId: r.item.id })}
            onPress={() => { if (raw) openLink(raw); }}
            leading={<View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: senderColor(domain.length * 7 + domain.charCodeAt(0)), alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#fff' }}>{domain.charAt(0).toUpperCase()}</Text></View>}
            title={domain}
            sub={raw}
            extra={(r.item.body ?? '').replace(raw, '').trim() || undefined}
            meta={`${r.item.sender.name} · ${formatDateOnly(r.item.created_at, { day: 'numeric', month: 'short' })}`} />
        );
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderRow}
        ListHeaderComponent={header}
        ListFooterComponent={shelf.isFetchingNextPage || (tab !== 'members' && shelf.isLoading) ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : <View style={{ height: insets.bottom + spacing.xl }} />}
        onEndReached={() => { if (tab !== 'members' && shelf.hasNextPage && !shelf.isFetchingNextPage) void shelf.fetchNextPage(); }}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      <ChatCalendarSheet visible={calendarOpen} courseId={courseId} onClose={() => setCalendarOpen(false)}
        onPick={(d) => { setCalendarOpen(false); jump({ date: d }); }}
        onLatest={() => { setCalendarOpen(false); useChatJump.getState().requestJump({ courseId, latest: true }); router.back(); }} />

      {viewer !== null && photos[viewer]?.attachment?.url && headers ? (
        <ImageViewer
          visible
          url={photos[viewer].attachment!.url!}
          headers={headers}
          name={photos[viewer].attachment!.name}
          caption={`${photos[viewer].sender.name} · ${formatDateTime(photos[viewer].created_at)}`}
          position={{ index: viewer, total: photos.length }}
          onPrev={viewer > 0 ? () => setViewer(viewer - 1) : undefined}
          onNext={viewer < photos.length - 1 ? () => setViewer(viewer + 1) : (shelf.hasNextPage ? () => { void shelf.fetchNextPage(); } : undefined)}
          onClose={() => setViewer(null)}
          onShare={() => { const a = photos[viewer].attachment; if (a) void openFile(a, headers, t); }}
          onShowInChat={() => { const id = photos[viewer].id; setViewer(null); jump({ messageId: id }); }}
        />
      ) : null}

      {preview?.attachment?.url && headers ? (
        <FilePreview visible url={preview.attachment.url} headers={headers} name={preview.attachment.name}
          onClose={() => setPreview(null)} onOpenExternally={() => { if (preview.attachment) void openFile(preview.attachment, headers, t); }} />
      ) : null}

      {moderator ? (
        <>
          <ChatReportsSheet visible={reportsOpen} onClose={() => setReportsOpen(false)} courseId={courseId}
            reports={reports.data?.reports ?? []} muteMaxHours={reports.data?.mute_max_hours ?? 72} loading={reports.isLoading} />
          <MuteSheet target={muting} maxHours={reports.data?.mute_max_hours ?? 72} pending={mute.isPending} onClose={() => setMuting(null)}
            onSubmit={(hours, reason) => {
              if (!muting) return;
              mute.mutate({ userId: muting.id, hours, reason }, {
                onSuccess: (msg) => { setMuting(null); Alert.alert('', msg); },
                onError: (err) => Alert.alert('', getFriendlyErrorMessage(err)),
              });
            }} />
        </>
      ) : null}
    </View>
  );
}

/** One member: who, their role (moderators flagged), and — for a moderator — how they are doing. */
function MemberRow({ m, viewerIsModerator, readOnly = false, onPress }: { m: ChatMember; viewerIsModerator: boolean; readOnly?: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const tappable = !m.is_you && !m.is_moderator && !readOnly;
  const chips: { key: string; text: string; bg: string; ink: string; icon?: IconName }[] = [];
  if (m.mute) chips.push({ key: 'mute', text: t('chat.muted_until', { time: formatDateTime(m.mute.until) }), bg: colors.dangerLight, ink: colors.dangerText, icon: 'mute' });
  if (m.open_reports) chips.push({ key: 'rep', text: t('chat.member_reports', { n: formatNumber(m.open_reports) }), bg: colors.warningLight, ink: colors.warningText, icon: 'flag' });
  if (m.hidden_by_you) chips.push({ key: 'hid', text: t('chat.hidden_by_you'), bg: colors.surfaceSunken, ink: colors.textSecondary, icon: 'eyeOff' });
  const activity = viewerIsModerator && !m.is_moderator
    ? [m.messages_30d ? t('chat.member_messages', { n: formatNumber(m.messages_30d) }) : t('chat.member_quiet'),
      m.last_read_at ? t('chat.member_read', { when: timeAgo(m.last_read_at) }) : t('chat.member_never_read')].join(' · ')
    : null;

  return (
    <TouchableOpacity onPress={onPress} disabled={!tappable} activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: m.role === 'teacher' ? chat.staffInk : senderColor(m.id), alignItems: 'center', justifyContent: 'center', opacity: m.hidden_by_you ? 0.5 : 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }}>{(m.name || '؟').trim().charAt(0)}</Text>
        {m.is_moderator ? (
          // The moderator's flag: a small shield on the avatar, readable without words.
          <View style={{ position: 'absolute', bottom: -2, end: -2, width: 19, height: 19, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background }}>
            <Icon name="shield" size={10} color="#fff" />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{m.name}</Text>
          {m.is_you ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{t('chat.you_paren')}</Text> : null}
          {m.is_moderator ? (
            <View style={{ backgroundColor: chat.staffInk, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>{m.role === 'teacher' ? t('chat.teacher_badge') : t('chat.assistant_badge')}</Text>
            </View>
          ) : null}
          {m.is_moderator ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.accentText }}>{t('chat.moderator_flag')}</Text> : null}
        </View>
        {m.label ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 1, textAlign: 'right' }} numberOfLines={1}>{m.label}</Text> : null}
        {activity ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2, textAlign: 'right' }} numberOfLines={1}>{activity}</Text> : null}
        {chips.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {chips.map((c) => (
              <View key={c.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.bg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
                {c.icon ? <Icon name={c.icon} size={11} color={c.ink} /> : null}
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: c.ink }}>{c.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {tappable ? <Icon name="back" size={16} color={colors.textTertiary} /> : null}
    </TouchableOpacity>
  );
}

/** A file or a link on the shelf: what it is, who sent it when, and «show in chat». */
function ShelfRow({ leading, title, sub, extra, meta, onPress, onShowInChat }: {
  item: ChatMessage;
  leading: ReactNode;
  title: string;
  sub?: string;
  extra?: string;
  meta?: string;
  onPress: () => void;
  onShowInChat: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm }}>
      {leading}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary, textAlign: 'right' }} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.brand, textAlign: 'right', writingDirection: 'ltr' }} numberOfLines={1}>{sub}</Text> : null}
        {extra ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, textAlign: 'right', marginTop: 2 }} numberOfLines={2}>{extra}</Text> : null}
        {meta ? <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, textAlign: 'right', marginTop: 2 }} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <ShowInChatButton onPress={onShowInChat} />
    </TouchableOpacity>
  );
}

function ShowInChatButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('chat.show_in_chat')}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="chat" size={17} color={colors.brand} outline />
    </TouchableOpacity>
  );
}
