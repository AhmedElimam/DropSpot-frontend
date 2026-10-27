import { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { roomIdOf } from '@/chat/room';
import type { ChatChannelSummary } from '@/api/chat';

/**
 * «رسائل جديدة» on the home screen — ONE card in the attention stack (beside the billing and
 * absence alerts), drawn only while something is unread. Nothing on a quiet day: the
 * conversations already have their own tab, so the home does not need a permanent entry
 * (founder 2026-10-28: the loose strip under the shortcuts was out of place). One unread
 * room opens that room; several open the inbox.
 */
export const ChatUnreadCard = memo(function ChatUnreadCard({ channels, inbox, room }: {
  channels: ChatChannelSummary[];
  /** Where the inbox lives for this role. */
  inbox: Href;
  /** The route of one room (`room` is the id the inbox would open). */
  room: (id: number) => Href;
}) {
  const { t } = useTranslation();
  const unread = channels.filter((c) => (c.unread || 0) > 0);
  const total = unread.reduce((n, c) => n + c.unread, 0);
  if (total === 0) return null;
  const one = unread.length === 1 ? unread[0] : null;
  const body = one
    ? t('chat.home_unread_one', { n: formatNumber(total), course: one.course_name ?? '' })
    : t('chat.home_unread_many', { n: formatNumber(total), rooms: formatNumber(unread.length) });
  return (
    <TouchableOpacity
      onPress={() => router.push(one ? room(roomIdOf(one)) : inbox)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${t('chat.home_unread_title')} — ${body}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.infoLight, borderWidth: 1, borderColor: colors.info, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderStartWidth: 4, borderStartColor: colors.info, minHeight: 60 }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="chat" size={19} color={colors.info} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{t('chat.home_unread_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, marginTop: 1 }} numberOfLines={2}>{body}</Text>
      </View>
      {/* RTL: a row's disclosure points LEFT (`back` → chevron-back). */}
      <Icon name="back" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
});
