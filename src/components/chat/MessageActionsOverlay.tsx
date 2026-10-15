import { useEffect } from 'react';
import { View, Text, TouchableOpacity, Pressable, I18nManager, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppModal as Modal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ChatBubble, bubbleSide, type BubbleRect } from '@/components/chat/ChatBubble';
import { CHAT_REACTIONS, type ChatMessage } from '@/api/chat';
import { haptic } from '@/utils/haptics';

export interface MessageAction {
  key: string;
  label: string;
  icon: IconName;
  destructive?: boolean;
  onPress: () => void;
}

const BAR_H = 54;
const ROW_H = 50;
const GAP = 8;

/**
 * Where the lifted message, the reaction bar and the action card go: the bar above the
 * message, the card below, and the message itself nudged up or down just enough that all
 * three fit on screen. Pure — tested.
 */
export function overlayLayout(rect: BubbleRect, screenH: number, insetTop: number, insetBottom: number, actions: number, showBar: boolean): { top: number; barTop: number; cardTop: number } {
  const barSpace = showBar ? BAR_H + GAP : 0;
  const cardH = actions * ROW_H + 12;
  const minTop = insetTop + 12 + barSpace;
  const maxTop = screenH - insetBottom - 12 - cardH - GAP - rect.height;
  const top = Math.max(minTop, Math.min(rect.y, Math.max(minTop, maxTop)));
  return { top, barTop: top - barSpace, cardTop: top + rect.height + GAP };
}

/**
 * Hold a message (founder 2026-10-12: «reactions on hold, like WhatsApp»): the room dims, the
 * message lifts exactly where it was, the reactions open above it and what you can do with it
 * below. Tap an emoji to react (tap your own again to take it back); tap outside to close.
 */
export function MessageActionsOverlay({ target, mine, myId, myReaction, canReact, actions, onReact, onClose }: {
  target: { message: ChatMessage; rect: BubbleRect } | null;
  mine: boolean;
  myId?: number;
  myReaction: string | null;
  canReact: boolean;
  actions: MessageAction[];
  onReact: (emoji: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const rtl = I18nManager.isRTL;
  const y = useSharedValue(0);
  const layout = target ? overlayLayout(target.rect, height, insets.top, insets.bottom, actions.length, canReact) : null;

  useEffect(() => {
    if (!target || !layout) return;
    y.value = target.rect.y;
    y.value = withSpring(layout.top, { damping: 20, stiffness: 260 });
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  const cloneStyle = useAnimatedStyle(() => ({ top: y.value }));
  const lift = useSharedValue(1);
  useEffect(() => { if (target) { lift.value = 0.96; lift.value = withTiming(1, { duration: 160 }); } }, [target, lift]);
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ scale: lift.value }] }));

  if (!target || !layout) return null;
  const side = bubbleSide(mine, rtl);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} style={{ flex: 1 }}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(8,12,30,0.45)' }} />

        {/* The message, lifted where it was. */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, paddingHorizontal: spacing.md }, cloneStyle, liftStyle]}>
          <ChatBubble message={target.message} mine={mine} showName={!mine} showTail myId={myId} onLongPress={() => undefined} bare />
        </Animated.View>

        {canReact ? (
          <View pointerEvents="box-none" style={{ position: 'absolute', top: layout.barTop, left: 0, right: 0, paddingHorizontal: spacing.md }}>
            <Animated.View entering={ZoomIn.springify().damping(15).stiffness(220)}
              style={{ alignSelf: side, flexDirection: 'row', gap: 2, height: BAR_H, paddingHorizontal: 6, alignItems: 'center', borderRadius: BAR_H / 2, backgroundColor: colors.surface, ...shadows.lg }}>
              {CHAT_REACTIONS.map((e, i) => {
                const on = myReaction === e;
                return (
                  <Animated.View key={e} entering={ZoomIn.delay(30 + i * 28).springify().damping(12)}>
                    <TouchableOpacity
                      onPress={() => { haptic('tick'); onReact(e); }}
                      accessibilityRole="button"
                      accessibilityLabel={t('chat.react_with', { emoji: e })}
                      accessibilityState={{ selected: on }}
                      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.brandTint : 'transparent' }}
                    >
                      <Text style={{ fontSize: 26 }}>{e}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </Animated.View>
          </View>
        ) : null}

        {actions.length ? (
          <View pointerEvents="box-none" style={{ position: 'absolute', top: layout.cardTop, left: 0, right: 0, paddingHorizontal: spacing.md }}>
            <Animated.View entering={FadeIn.duration(160).delay(40)}
              style={{ alignSelf: side, width: 236, borderRadius: radius.xl, backgroundColor: colors.surface, paddingVertical: 6, ...shadows.lg }}>
              {actions.map((a, i) => (
                <TouchableOpacity key={a.key} onPress={a.onPress} accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, height: ROW_H, paddingHorizontal: spacing.lg, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.borderLight }}>
                  <Icon name={a.icon} size={19} color={a.destructive ? colors.danger : colors.textSecondary} outline />
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: a.destructive ? colors.danger : colors.textPrimary, textAlign: 'right' }}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          </View>
        ) : null}
      </Animated.View>
    </Modal>
  );
}
