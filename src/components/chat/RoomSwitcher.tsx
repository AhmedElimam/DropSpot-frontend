import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { SheetModal } from '@/components/ui/SheetModal';
import { Icon } from '@/components/ui/Icon';
import { RoomAvatar, roomBadge } from '@/components/chat/RoomAvatar';
import { useChatChannels } from '@/hooks/useChat';
import { filterInbox, hasBothAudiences, sortRooms } from '@/chat/inbox';
import { roomIdOf, type RoomId } from '@/chat/room';
import { formatNumber, formatShortDate, formatTime, relativeDay } from '@/utils/format';
import type { ChatChannelSummary } from '@/api/chat';

/**
 * Jump to another room without leaving this one first (founder 2026-10-12: «an easy access
 * (shortcut) in chat to switch to any other chat instantly»). One tap in the room's header
 * opens every room this person has, newest first, unread marked; a tap swaps the room in
 * place — the back gesture still returns to the list, not through every room visited.
 */
export function RoomSwitcher({ visible, current, onClose, onPick }: {
  visible: boolean;
  current: RoomId;
  onClose: () => void;
  onPick: (room: RoomId) => void;
}) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const { data } = useChatChannels();
  const [query, setQuery] = useState('');
  const all = useMemo(() => data ?? [], [data]);
  const both = hasBothAudiences(all);
  const rooms = useMemo(() => sortRooms(filterInbox(all, 'all', query)), [all, query]);

  return (
    <SheetModal visible={visible} onClose={() => { setQuery(''); onClose(); }} avoidKeyboard>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, textAlign: 'right' }}>{t('chat.switch_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2, textAlign: 'right' }}>{t('chat.switch_sub')}</Text>
        {all.length > 6 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, height: 44, borderRadius: radius.lg, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border }}>
            <Icon name="search" size={17} color={colors.textTertiary} outline />
            <TextInput value={query} onChangeText={setQuery} placeholder={t('chat.inbox_search')} placeholderTextColor={colors.textTertiary}
              style={{ flex: 1, height: 44, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }} />
          </View>
        ) : null}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: height * 0.62 }} contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled">
        {rooms.map((c) => <SwitchRow key={roomIdOf(c)} room={c} here={roomIdOf(c) === current} both={both} onPick={onPick} />)}
        {!rooms.length ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xl }}>
            {t('chat.empty_search', { q: query.trim() })}
          </Text>
        ) : null}
      </ScrollView>
    </SheetModal>
  );
}

function SwitchRow({ room: c, here, both, onPick }: { room: ChatChannelSummary; here: boolean; both: boolean; onPick: (room: RoomId) => void }) {
  const { t } = useTranslation();
  const unread = c.unread > 0 && !here;
  // With two rooms per course, say which one — the course alone would be ambiguous.
  const which = !both ? null : c.audience === 'parents' ? t('chat.room_parents') : c.read_only ? t('chat.room_following', { names: (c.children ?? []).join('، ') }) : t('chat.room_students');
  const preview = c.last_preview ? `${c.last_mine ? t('chat.you') : (c.last_sender ?? '')}: ${c.last_preview}` : t('chat.no_preview');

  return (
    <TouchableOpacity onPress={() => onPick(roomIdOf(c))} disabled={here} activeOpacity={0.6}
      accessibilityRole="button" accessibilityState={{ selected: here }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: here ? colors.brandTint : 'transparent' }}>
      <RoomAvatar room={roomIdOf(c)} size={46} badge={both ? roomBadge(c) : null} label={c.course_name ?? ''} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{c.course_name ?? '—'}</Text>
          {here ? (
            <View style={{ backgroundColor: colors.brand, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: colors.onPrimary }}>{t('chat.switch_here')}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <Text style={{ fontFamily: unread ? fonts.bold : fonts.regular, fontSize: 11.5, color: unread ? colors.success : colors.textTertiary }}>{stamp(c.last_message_at)}</Text>
        </View>
        {which ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: c.audience === 'parents' ? colors.accentText : colors.brand, textAlign: 'right' }} numberOfLines={1}>{which}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
          <Text style={{ flex: 1, fontFamily: unread ? fonts.medium : fonts.regular, fontSize: 13, color: unread ? colors.textSecondary : colors.textTertiary, textAlign: 'right' }} numberOfLines={1}>{preview}</Text>
          {unread ? (
            <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.onPrimary }}>{c.unread > 99 ? '99+' : formatNumber(c.unread)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function stamp(iso: string | null): string {
  if (!iso) return '';
  const rel = relativeDay(iso);
  if (rel === 'اليوم') return formatTime(iso);
  if (rel) return rel;
  return formatShortDate(iso);
}
