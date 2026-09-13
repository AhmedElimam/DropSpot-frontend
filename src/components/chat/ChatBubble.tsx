import { memo } from 'react';
import { View, Text, TouchableOpacity, I18nManager } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { spacing, radius } from '@/theme/index';
import { chat, senderColor } from '@/theme/chat';
import { Icon } from '@/components/ui/Icon';
import { AttachmentBubble } from '@/components/chat/AttachmentBubble';
import { formatTime } from '@/utils/format';
import type { ChatMessage } from '@/api/chat';

/**
 * One message, in the shape any messenger user already knows: a tinted bubble for your own
 * words, white for everyone else, a tail on the first of a run, the sender's name in their
 * own colour, and the time tucked in beside the last line.
 *
 * Two departures, both deliberate:
 *  - a STAFF message is warm-tinted and badged «المعلّم» / «مساعد». A child must be able to
 *    tell an adult's voice without reading;
 *  - the tick is SINGLE and means "sent". There is no second tick because this product has
 *    no read receipts — showing two would be a claim the server cannot make.
 *
 * The time sits in a wrapping row with the text: short messages keep it on the same line,
 * long ones let it fall to its own. No absolute positioning, so it cannot overlap a wrap.
 */
export const ChatBubble = memo(function ChatBubble({
  message, mine, showName, showTail, onLongPress,
}: {
  message: ChatMessage;
  mine: boolean;
  showName: boolean;
  showTail: boolean;
  onLongPress: (m: ChatMessage) => void;
}) {
  const { t } = useTranslation();
  const staff = message.sender.is_staff;
  const hasText = !!message.body && message.body.trim() !== '';

  const bg = mine ? chat.bubbleMine : staff ? chat.bubbleStaff : chat.bubbleTheirs;
  const metaColor = mine ? chat.metaOnMine : chat.meta;

  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%', marginTop: showName || showTail ? spacing.sm : 2 }}>
      <TouchableOpacity
        onLongPress={() => onLongPress(message)}
        delayLongPress={350}
        activeOpacity={0.92}
        accessibilityHint={t('chat.message_actions')}
        style={{
          backgroundColor: bg,
          borderWidth: staff && !mine ? 1 : 0,
          borderColor: chat.bubbleStaffBorder,
          borderRadius: radius.lg,
          // The corner the tail grows from stays square; the rest are round.
          borderBottomEndRadius: mine && showTail ? 2 : radius.lg,
          borderBottomStartRadius: !mine && showTail ? 2 : radius.lg,
          paddingHorizontal: spacing.md,
          paddingTop: 6,
          paddingBottom: 5,
          // A flat, close shadow — the WhatsApp lift, not a card.
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 1,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        }}
      >
        {showName && !mine ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: staff ? '#8A5B00' : senderColor(message.sender.id) }}>
              {message.sender.name}
            </Text>
            {staff ? (
              <View style={{ backgroundColor: '#8A5B00', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>
                  {message.sender.is_teacher ? t('chat.teacher_badge') : t('chat.assistant_badge')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {message.attachment ? (
          <View style={{ marginBottom: hasText ? 4 : 0 }}>
            <AttachmentBubble attachment={message.attachment} mine={false} onLongPress={() => onLongPress(message)} />
          </View>
        ) : null}

        {/* Text and meta share a wrapping row — the messenger layout, without overlap risk. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          {hasText ? (
            <Text style={{ flexShrink: 1, fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: chat.text, textAlign: 'right' }}>
              {message.body}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginStart: spacing.sm, marginTop: 2 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: metaColor }}>
              {formatTime(message.created_at)}
            </Text>
            {mine ? <Icon name="check" size={13} color={chat.tick} /> : null}
          </View>
        </View>
      </TouchableOpacity>

      {showTail ? <Tail color={bg} mine={mine} /> : null}
    </View>
  );
});

/**
 * The little pointer at the bubble's bottom corner. Positioned with `start`/`end` rather
 * than left/right so it follows the writing direction: in this RTL app your own bubbles sit
 * on the left and point left, exactly as they do in an Arabic messenger.
 */
function Tail({ color, mine }: { color: string; mine: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 0,
        ...(mine ? { end: -6 } : { start: -6 }),
        // The path is drawn pointing one way; mirror it for the other side. In RTL the
        // physical sides are already swapped, so the flag flips with it.
        transform: [{ scaleX: (mine ? 1 : -1) * (I18nManager.isRTL ? -1 : 1) }],
      }}
    >
      <Svg width={8} height={12}>
        <Path d="M0 0 L0 12 L8 12 C3.5 9.5 0.5 5 0 0 Z" fill={color} />
      </Svg>
    </View>
  );
}
