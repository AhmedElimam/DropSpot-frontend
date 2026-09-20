import { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { spacing, radius, shadows } from '@/theme/index';
import { chat, senderColor } from '@/theme/chat';
import { Icon } from '@/components/ui/Icon';
import { AttachmentBubble } from '@/components/chat/AttachmentBubble';
import { formatTime } from '@/utils/format';
import type { ChatMessage } from '@/api/chat';

/**
 * One message, in this product's own bubble — the same shape a ticket reply already uses:
 * filled ink-indigo for your own voice, a bordered surface card for everyone else's, one
 * squared corner at the end of a run. No tails, no borrowed palette.
 *
 * Two things this room adds that a plain thread does not, both because the users are
 * children:
 *  - a STAFF message sits on the apricot tint and is badged «المعلّم» / «مساعد», so an
 *    adult's voice is identifiable without reading;
 *  - the tick is SINGLE and means "sent". There is no second tick because this product has
 *    no read receipts — showing two would be a claim the server cannot make.
 *
 * Time sits in a wrapping row with the text: short messages keep it on the same line, long
 * ones let it fall to its own. No absolute positioning, so it cannot overlap a wrap.
 */
export const ChatBubble = memo(function ChatBubble({
  message, mine, showName, showTail, onLongPress, onRetry,
}: {
  message: ChatMessage;
  mine: boolean;
  showName: boolean;
  /** Last of a run from one sender — squares the outer corner. */
  showTail: boolean;
  onLongPress: (m: ChatMessage) => void;
  /** A message that never reached the server — tapping it offers to try again. */
  onRetry?: (m: ChatMessage) => void;
}) {
  const { t } = useTranslation();
  const staff = message.sender.is_staff;
  const hasText = !!message.body && message.body.trim() !== '';
  // Optimistic state: on screen before the server has answered (clock), or after it
  // refused / the network dropped (failed — stays put with a retry, never silently lost).
  const sending = message.local?.status === 'sending';
  const failed = message.local?.status === 'failed';

  // A hidden message only ever reaches a MODERATOR with its text (§2) — students get it
  // filtered out entirely. So if it is on screen at all, show plainly that the room can no
  // longer see it, rather than letting a teacher mistake it for a live message.
  const hidden = message.hidden;

  const bg = hidden ? chat.bubbleHidden : mine ? chat.bubbleMine : staff ? chat.bubbleStaff : chat.bubbleTheirs;
  const border = hidden ? 'transparent' : staff && !mine ? chat.bubbleStaffBorder : mine ? 'transparent' : chat.bubbleTheirsBorder;
  const ink = hidden ? chat.hiddenInk : mine ? chat.textOnMine : chat.text;
  const metaInk = hidden ? chat.hiddenInk : mine ? chat.metaOnMine : chat.meta;

  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', marginTop: showName ? spacing.md : 3 }}>
      <TouchableOpacity
        onLongPress={() => onLongPress(message)}
        onPress={failed && onRetry ? () => onRetry(message) : undefined}
        delayLongPress={350}
        activeOpacity={0.9}
        accessibilityHint={failed ? t('chat.not_sent') : t('chat.message_actions')}
        style={{
          opacity: sending ? 0.78 : 1,
          backgroundColor: bg,
          borderWidth: mine && !hidden ? 0 : 1,
          borderColor: border,
          borderRadius: radius.xl,
          // The run's last bubble squares its outer corner — the app's own thread idiom.
          borderBottomEndRadius: mine && showTail ? 4 : radius.xl,
          borderBottomStartRadius: !mine && showTail ? 4 : radius.xl,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: 7,
          ...(mine ? {} : shadows.sm),
        }}
      >
        {showName && !mine ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: staff ? chat.staffInk : senderColor(message.sender.id) }}>
              {message.sender.name}
            </Text>
            {staff ? (
              <View style={{ backgroundColor: chat.staffInk, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 9.5, color: '#fff' }}>
                  {message.sender.is_teacher ? t('chat.teacher_badge') : t('chat.assistant_badge')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {message.attachment ? (
          <View style={{ marginBottom: hasText ? 6 : 0, opacity: hidden ? 0.6 : 1 }}>
            <AttachmentBubble attachment={message.attachment} mine={mine && !hidden} seed={message.id} onLongPress={() => onLongPress(message)} />
          </View>
        ) : null}

        {hidden ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <Icon name="eyeOff" size={12} color={chat.hiddenInk} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: chat.hiddenInk }}>{t('chat.hidden_note')}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          {hasText ? (
            <Text
              style={{
                flexShrink: 1, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24,
                color: ink, textAlign: 'right',
                textDecorationLine: hidden ? 'line-through' : 'none',
              }}
            >
              {message.body}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginStart: spacing.sm, marginTop: 2 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: metaInk }}>
              {formatTime(message.created_at)}
            </Text>
            {mine && !hidden ? (
              sending ? <Icon name="clock" size={12} color={chat.tick} outline />
              : failed ? <Icon name="error" size={13} color={chat.failedInk} />
              : <Icon name="check" size={13} color={chat.tick} />
            ) : null}
          </View>
        </View>

        {failed ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Icon name="refresh" size={12} color={chat.failedInk} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: chat.failedInk }}>{t('chat.not_sent')}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
});
