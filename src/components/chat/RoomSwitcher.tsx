import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { SheetModal } from '@/components/ui/SheetModal';
import { Icon } from '@/components/ui/Icon';
import { ChatInboxList, InboxChips } from '@/components/chat/ChatInbox';
import { useChatChannels } from '@/hooks/useChat';
import type { InboxFilter } from '@/chat/inbox';
import type { RoomId } from '@/chat/room';
import { formatNumber } from '@/utils/format';

/**
 * Jump to another room without leaving this one first (founder 2026-10-12: «an easy access
 * (shortcut) in chat to switch to any other chat instantly»), organised exactly like the
 * conversations page (founder, same day: «the modal needs some love organizing like what
 * we've did on that page»): the same filter chips, the same course cards holding a course's
 * rooms (or a student's messenger list), the room you are in marked «أنت هنا». A tap swaps
 * the room in place — the back gesture still returns to the list, not through every room.
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
  const [filter, setFilter] = useState<InboxFilter>('all');
  const list = useMemo(() => data ?? [], [data]);
  const elsewhere = list.reduce((n, c) => n + (c.unread || 0), 0);

  const close = () => { setQuery(''); setFilter('all'); onClose(); };

  return (
    // The sheet's own side padding off: the cards run edge to edge like on the page, with
    // one gutter of their own (founder 2026-10-12: «huge padding from left and right»).
    <SheetModal visible={visible} onClose={close} avoidKeyboard style={{ paddingHorizontal: 0 }}>
      {/* Head: what this is, what is waiting, and a way out. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="grid" size={21} color={colors.brand} outline />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, textAlign: 'right' }}>{t('chat.switch_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, textAlign: 'right' }}>
            {elsewhere > 0 ? t('chat.switch_waiting', { n: formatNumber(elsewhere) }) : t('chat.switch_sub')}
          </Text>
        </View>
        <TouchableOpacity onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {list.length > 5 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.md, height: 44, borderRadius: radius.lg, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border }}>
          <Icon name="search" size={17} color={colors.textTertiary} outline />
          <TextInput value={query} onChangeText={setQuery} placeholder={t('chat.inbox_search')} placeholderTextColor={colors.textTertiary}
            returnKeyType="search"
            style={{ flex: 1, height: 44, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }} />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
              <Icon name="close" size={15} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={{ paddingBottom: spacing.md }}>
        <InboxChips list={list} value={filter} onChange={setFilter} />
      </View>

      {/* The rooms, on the page's paper so the cards read as they do on the page. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: height * 0.6, borderTopWidth: 1, borderTopColor: colors.borderLight }}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.lg }}
      >
        <ChatInboxList onOpen={onPick} filter={filter} query={query} current={current} />
      </ScrollView>
    </SheetModal>
  );
}
