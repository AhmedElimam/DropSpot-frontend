import { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
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
 *  - one tick means "sent"; two mean someone else in the room has read it, and two in the
 *    bright seen colour mean everyone has (`message.seen`, from the members' read cursors).
 *    An older server sends no `seen`, and the tick stays single — never a claim it cannot make.
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
  // Outbox state: queued or on the wire (clock), or refused by the server (failed — stays
  // put with a retry button under it, never silently lost).
  const sending = message.local?.status === 'sending' || message.local?.status === 'queued';
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
    <Animated.View entering={sending ? FadeInDown.duration(180).springify().damping(18) : undefined} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', marginTop: showName ? spacing.md : 3 }}>
      <TouchableOpacity
        onLongPress={() => onLongPress(message)}
        delayLongPress={350}
        activeOpacity={0.9}
        accessibilityHint={failed ? t('chat.not_sent_short') : t('chat.message_actions')}
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
              : <Ticks seen={message.seen} />
            ) : null}
          </View>
        </View>

        {failed ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: chat.failedInk, marginTop: 4, textAlign: 'right' }}>
            {t('chat.not_sent_short')}
          </Text>
        ) : null}
      </TouchableOpacity>

      {/* The retry is its own padded button UNDER the bubble, not a line of small text inside
          it: a thumb needs room (founder 2026-10-12: «a little padding for reloading»). */}
      {failed && onRetry ? (
        <TouchableOpacity
          onPress={() => onRetry(message)}
          accessibilityRole="button"
          accessibilityLabel={t('chat.retry')}
          hitSlop={6}
          style={{
            alignSelf: mine ? 'flex-end' : 'flex-start', marginTop: 6,
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full,
            backgroundColor: colors.dangerLight, borderWidth: 1, borderColor: colors.danger,
          }}
        >
          <Icon name="refresh" size={14} color={colors.dangerText} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.dangerText }}>{t('chat.retry')}</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
});

/** Sent (one), read by someone (two), read by everyone (two, lit). Exported for tests. */
export function tickState(seen: ChatMessage['seen']): 'sent' | 'seen_some' | 'seen_all' {
  if (!seen || seen.count <= 0) return 'sent';
  return seen.all ? 'seen_all' : 'seen_some';
}

function Ticks({ seen }: { seen: ChatMessage['seen'] }) {
  const state = tickState(seen);
  const color = state === 'seen_all' ? chat.tickSeen : chat.tick;
  return (
    <View style={{ flexDirection: 'row', width: state === 'sent' ? 13 : 19, height: 13 }}>
      <Icon name="check" size={13} color={color} />
      {state !== 'sent' ? <Icon name="check" size={13} color={color} style={{ marginStart: -7 }} /> : null}
    </View>
  );
}
