import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { senderColor } from '@/theme/chat';
import { useChatChannels, useChatEnabled } from '@/hooks/useChat';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatShortDate, formatTime, relativeDay } from '@/utils/format';
import type { ChatChannelSummary } from '@/api/chat';

/**
 * The rooms, as a messenger's conversation list: avatar, name, one preview line, time,
 * unread pill. Shared by the student's Chat tab and the teacher's Chat segment — the rows
 * are identical because the rooms are; only where you tap through to differs.
 *
 * Every course the person belongs to appears, including ones nobody has written in yet:
 * the room always exists, and an empty list would read as a missing feature.
 */
export function ChatRoomsList({ onOpen }: { onOpen: (courseId: number) => void }) {
  const { t } = useTranslation();
  const enabled = useChatEnabled();
  // Same query key as the host screen's pull-to-refresh, so this is not a second fetch.
  const { data: channels, isLoading } = useChatChannels();

  if (!enabled) return <EmptyState icon="chat" title={t('common.not_available')} />;
  if (isLoading) return <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl4 }} />;

  const list = channels ?? [];
  if (list.length === 0) return <EmptyState icon="chat" title={t('chat.empty_title')} message={t('chat.empty_body')} />;

  return (
    <View>
      {list.map((c, i) => (
        <Row key={c.course_id} channel={c} last={i === list.length - 1} onOpen={onOpen} />
      ))}
    </View>
  );
}

function Row({ channel: c, last, onOpen }: { channel: ChatChannelSummary; last: boolean; onOpen: (id: number) => void }) {
  const { t } = useTranslation();
  const unread = c.unread > 0;
  const name = c.course_name ?? '—';

  // Who said it, then what — the two halves of a messenger preview line.
  const preview = c.last_preview
    ? `${c.last_mine ? t('chat.you') : (c.last_sender ?? '')}: ${c.last_preview}`
    : t('chat.no_preview');

  return (
    <TouchableOpacity
      onPress={() => onOpen(c.course_id)}
      activeOpacity={0.6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface }}
    >
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: senderColor(c.course_id), alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: '#fff' }}>{name.trim().charAt(0)}</Text>
      </View>

      <View style={{ flex: 1, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.borderLight, paddingBottom: spacing.md, marginBottom: -spacing.md, paddingTop: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16.5, color: colors.textPrimary }} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: unread ? colors.success : colors.textTertiary }}>
            {stamp(c.last_message_at)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 }}>
          <Text
            style={{ flex: 1, fontFamily: unread ? fonts.medium : fonts.regular, fontSize: 14, color: unread ? colors.textSecondary : colors.textTertiary }}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {!c.notify ? <Icon name="bellOff" size={14} color={colors.textTertiary} outline /> : null}
          {c.locked ? <Icon name="lock" size={13} color={colors.textTertiary} /> : null}
          {c.announcements_only ? <Icon name="info" size={13} color={colors.textTertiary} outline /> : null}
          {unread ? (
            <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{c.unread > 99 ? '99+' : c.unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** Time for today, «أمس» for yesterday, a short date beyond — the messenger convention. */
function stamp(iso: string | null): string {
  if (!iso) return '';
  const rel = relativeDay(iso);
  if (rel === 'اليوم') return formatTime(iso);
  if (rel) return rel;
  return formatShortDate(iso);
}
