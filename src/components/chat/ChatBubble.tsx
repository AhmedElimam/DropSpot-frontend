import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, I18nManager } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation, FadeInDown, ZoomIn, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { chat, senderColor } from '@/theme/chat';
import { Icon, type IconName } from '@/components/ui/Icon';
import { AttachmentBubble } from '@/components/chat/AttachmentBubble';
import { formatTime } from '@/utils/format';
import { linkify, openLink } from '@/components/chat/linkify';
import { haptic } from '@/utils/haptics';
import type { ChatMessage } from '@/api/chat';

/** How far a message is dragged before letting go replies to it. */
export const REPLY_DX = 64;

export interface BubbleRect { x: number; y: number; width: number; height: number }

/**
 * Which edge a message sits on — PHYSICAL, whatever the layout direction: my messages on the
 * RIGHT, everyone else's on the left (founder 2026-10-12: «me as the sender, my messages on
 * the right»). Under the app's forced RTL «flex-start» is the right edge, so the flex value
 * flips with the direction while the side on screen does not. Pure — tested.
 */
export function bubbleSide(mine: boolean, rtl: boolean): 'flex-start' | 'flex-end' {
  return mine === rtl ? 'flex-start' : 'flex-end';
}

/** The squared corner at the end of a run: bottom-right for mine, bottom-left for theirs. */
export function tailCorner(mine: boolean, rtl: boolean): { borderBottomStartRadius?: number; borderBottomEndRadius?: number } {
  const startIsRight = rtl;
  const right = startIsRight ? 'borderBottomStartRadius' : 'borderBottomEndRadius';
  const left = startIsRight ? 'borderBottomEndRadius' : 'borderBottomStartRadius';
  return { [mine ? right : left]: 4 };
}

/**
 * One message, in this product's own bubble — the same shape a ticket reply already uses:
 * filled ink-indigo for your own voice, a bordered surface card for everyone else's, one
 * squared corner at the end of a run.
 *
 * What the room adds (founder 2026-10-12, «like WhatsApp»):
 *  - **swipe right to reply** — the bubble follows the finger, a reply arrow fades in where it
 *    was, a tap of haptics at the line; let go past it and the composer quotes this message;
 *  - **a quote** on a reply — who and what it answers; tap it to jump there;
 *  - **reactions** under the bubble — tap one to add or take back your own;
 *  - **hold** opens the reaction bar and the actions over a dimmed room (the parent measures
 *    the bubble, so the lifted copy sits exactly where the message is).
 *
 * Because the users are children: a STAFF message sits on the apricot tint and is badged
 * «المعلّم» / «مساعد»; ticks say only what the server can vouch for.
 */
export const ChatBubble = memo(function ChatBubble({
  message, mine, showName, showTail, onLongPress, onRetry, highlight = false,
  onReply, onQuotePress, onReact, myId, bare = false,
}: {
  message: ChatMessage;
  mine: boolean;
  showName: boolean;
  /** Last of a run from one sender — squares the outer corner. */
  showTail: boolean;
  /** Hold. With the bubble's place on screen, for the reaction overlay. */
  onLongPress: (m: ChatMessage, rect?: BubbleRect) => void;
  /** A message that never reached the server — tapping it offers to try again. */
  onRetry?: (m: ChatMessage) => void;
  /** The message a jump landed on («show in chat», a calendar day): it glows once. */
  highlight?: boolean;
  /** Swipe right to reply. Absent = no swipe (a room you cannot write in). */
  onReply?: (m: ChatMessage) => void;
  /** Tap a quote to open the room at the quoted message. */
  onQuotePress?: (messageId: number) => void;
  /** Tap a reaction chip: add or take back mine with that emoji. */
  onReact?: (m: ChatMessage, emoji: string) => void;
  myId?: number;
  /** The lifted copy in the hold overlay: no margins, no gestures, no entrance. */
  bare?: boolean;
}) {
  const { t } = useTranslation();
  const rtl = I18nManager.isRTL;
  const staff = message.sender.is_staff;
  const hasText = !!message.body && message.body.trim() !== '';
  // Outbox state: queued or on the wire (clock), or refused by the server (failed — stays
  // put with a retry button under it, never silently lost).
  const sending = message.local?.status === 'sending' || message.local?.status === 'queued';
  const failed = message.local?.status === 'failed';
  const hidden = message.hidden;
  const side = bubbleSide(mine, rtl);

  const bg = hidden ? chat.bubbleHidden : mine ? chat.bubbleMine : staff ? chat.bubbleStaff : chat.bubbleTheirs;
  const border = hidden ? 'transparent' : staff && !mine ? chat.bubbleStaffBorder : mine ? 'transparent' : chat.bubbleTheirsBorder;
  const ink = hidden ? chat.hiddenInk : mine ? chat.textOnMine : chat.text;
  const metaInk = hidden ? chat.hiddenInk : mine ? chat.metaOnMine : chat.meta;

  // The landing glow: up, hold, fade — so the eye finds the message the jump opened on.
  const glow = useSharedValue(0);
  useEffect(() => {
    if (highlight) glow.value = withSequence(withTiming(1, { duration: 180 }), withDelay(1100, withTiming(0, { duration: 700 })));
  }, [highlight, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  // ── Swipe to reply ─────────────────────────────────────────────────────────────────
  const dx = useSharedValue(0);
  const armed = useSharedValue(0);
  const fireReply = useCallback(() => onReply?.(message), [onReply, message]);
  const tick = useCallback(() => haptic('light'), []);
  const canSwipe = !!onReply && !bare && !message.local && !hidden;
  const swipe = useMemo(() => Gesture.Pan()
    .enabled(canSwipe)
    // Rightward only, and only once clearly sideways — a vertical scroll always wins.
    .activeOffsetX(14)
    .failOffsetX(-12)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      const x = Math.max(0, e.translationX);
      // Past the line the bubble resists, so the reply feels "caught".
      dx.value = x <= REPLY_DX ? x : REPLY_DX + (x - REPLY_DX) * 0.35;
      if (x >= REPLY_DX && armed.value === 0) { armed.value = 1; runOnJS(tick)(); }
      else if (x < REPLY_DX && armed.value === 1) armed.value = 0;
    })
    .onEnd(() => { if (armed.value === 1) runOnJS(fireReply)(); })
    .onFinalize(() => {
      dx.value = withSpring(0, { damping: 18, stiffness: 260, mass: 0.7 });
      armed.value = 0;
    }), [canSwipe, dx, armed, tick, fireReply]);
  const moveStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }] }));
  const arrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dx.value, [12, REPLY_DX], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(dx.value, [12, REPLY_DX, REPLY_DX + 20], [0.4, 1, 1.15], Extrapolation.CLAMP) }],
  }));

  // ── Hold: measure, so the overlay lifts the bubble exactly where it is ───────────────
  const box = useRef<View>(null);
  const hold = useCallback(() => {
    haptic('medium');
    if (!box.current) { onLongPress(message); return; }
    box.current.measureInWindow((x, y, width, height) => onLongPress(message, { x, y, width, height }));
  }, [onLongPress, message]);

  const reply = message.reply_to;
  const reactions = message.reactions ?? [];
  const replyColor = reply ? (reply.sender_id === myId ? colors.brand : senderColor(reply.sender_id)) : colors.brand;

  const bubble = (
    <TouchableOpacity
      onLongPress={bare ? undefined : hold}
      delayLongPress={320}
      activeOpacity={0.9}
      disabled={bare}
      accessibilityHint={failed ? t('chat.not_sent_short') : t('chat.message_actions')}
      style={{
        opacity: sending ? 0.78 : 1,
        backgroundColor: bg,
        borderWidth: mine && !hidden ? 0 : 1,
        borderColor: border,
        borderRadius: radius.xl,
        // The run's last bubble squares its outer corner — the app's own thread idiom.
        ...(showTail ? tailCorner(mine, rtl) : {}),
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: 7,
        ...(mine ? {} : shadows.sm),
      }}
    >
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -3, bottom: -3, left: -3, right: -3, borderRadius: radius.xl + 3, borderWidth: 2, borderColor: colors.accent, backgroundColor: 'rgba(242,169,59,0.16)' }, glowStyle]} />
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

      {reply ? (
        <TouchableOpacity
          onPress={onQuotePress && !reply.hidden ? () => onQuotePress(reply.id) : undefined}
          disabled={!onQuotePress || reply.hidden || bare}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={t('chat.reply_to', { name: reply.sender_name })}
          style={{
            borderRadius: radius.md, marginBottom: 6, paddingHorizontal: 9, paddingVertical: 5,
            backgroundColor: mine ? 'rgba(255,255,255,0.15)' : colors.surfaceSunken,
            borderStartWidth: 3, borderStartColor: mine ? 'rgba(255,255,255,0.85)' : replyColor,
          }}
        >
          <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 12, color: mine ? '#fff' : replyColor, textAlign: 'right' }}>
            {reply.sender_id === myId ? t('chat.you') : reply.sender_name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {reply.kind !== 'text' && !reply.hidden ? <Icon name={QUOTE_ICON[reply.kind]} size={12} color={mine ? chat.metaOnMine : colors.textTertiary} outline /> : null}
            <Text numberOfLines={2} style={{ flexShrink: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: mine ? chat.metaOnMine : colors.textSecondary, textAlign: 'right', fontStyle: reply.hidden ? 'italic' : 'normal' }}>
              {reply.preview ?? t('chat.reply_hidden')}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {message.attachment ? (
        <View style={{ marginBottom: hasText ? 6 : 0, opacity: hidden ? 0.6 : 1 }}>
          <AttachmentBubble attachment={message.attachment} mine={mine && !hidden} seed={message.id} onLongPress={bare ? undefined : hold} />
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
            {hidden ? message.body : linkify(message.body ?? '').map((seg, i) => seg.url ? (
              <Text
                key={i}
                onPress={() => openLink(seg.url!)}
                onLongPress={bare ? undefined : hold}
                accessibilityRole="link"
                style={{ textDecorationLine: 'underline', color: mine ? '#FFFFFF' : colors.brand, fontFamily: fonts.medium }}
              >
                {seg.text}
              </Text>
            ) : seg.text)}
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
  );

  const chips = reactions.length ? (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -7, paddingHorizontal: spacing.sm, alignSelf: side, zIndex: 2 }}>
      {reactions.map((r) => {
        const own = myId != null && r.user_ids.includes(myId);
        return (
          <Animated.View key={r.emoji} entering={bare ? undefined : ZoomIn.springify().damping(14)}>
            <TouchableOpacity
              onPress={onReact && !bare ? () => onReact(message, r.emoji) : undefined}
              disabled={!onReact || bare}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('chat.reaction_label', { emoji: r.emoji, n: r.count })}
              accessibilityState={{ selected: own }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 3, height: 26, paddingHorizontal: 8, borderRadius: 13,
                backgroundColor: own ? colors.brandTint : colors.surface,
                borderWidth: 1.5, borderColor: own ? colors.brand : colors.border, ...shadows.sm,
              }}
            >
              <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
              {r.count > 1 ? <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: own ? colors.brand : colors.textSecondary }}>{r.count}</Text> : null}
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  ) : null;

  return (
    <Animated.View
      entering={sending && !bare ? FadeInDown.duration(180).springify().damping(18) : undefined}
      style={{ alignSelf: side, maxWidth: '85%', marginTop: bare ? 0 : showName ? spacing.md : 3 }}
    >
      {canSwipe ? (
        // The reply arrow waits at the bubble's left edge; the bubble slides off it.
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, justifyContent: 'center', width: 34, ...(rtl ? { end: 0 } : { start: 0 }) }, arrowStyle]}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadows.sm }}>
            <Icon name="reply" size={16} color={colors.brand} />
          </View>
        </Animated.View>
      ) : null}
      <GestureDetector gesture={swipe}>
        <Animated.View ref={box} collapsable={false} style={moveStyle}>
          {bubble}
          {chips}
        </Animated.View>
      </GestureDetector>

      {/* The retry is its own padded button UNDER the bubble, not a line of small text inside
          it: a thumb needs room (founder 2026-10-12: «a little padding for reloading»). */}
      {failed && onRetry && !bare ? (
        <TouchableOpacity
          onPress={() => onRetry(message)}
          accessibilityRole="button"
          accessibilityLabel={t('chat.retry')}
          hitSlop={6}
          style={{
            alignSelf: side, marginTop: 6,
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

const QUOTE_ICON: Record<'image' | 'file' | 'voice', IconName> = { image: 'image', file: 'attach', voice: 'mic' };

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
