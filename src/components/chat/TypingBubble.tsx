import { useEffect } from 'react';
import { View, Text, I18nManager } from 'react-native';
import Animated, { Easing, FadeInUp, FadeOutDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { chat } from '@/theme/chat';
import { bubbleSide, tailCorner } from '@/components/chat/ChatBubble';

/**
 * «يكتب…» as a small bubble at the foot of the room — three dots breathing in turn, the way
 * every messenger the family already uses says it — beside the header line. Unmounts (and
 * stops its timers) the moment nobody is typing, so an idle room animates nothing.
 */
export function TypingBubble({ label }: { label: string }) {
  return (
    <Animated.View entering={FadeInUp.duration(160)} exiting={FadeOutDown.duration(120)} style={{ alignSelf: bubbleSide(false, I18nManager.isRTL), marginTop: 6, marginBottom: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: chat.bubbleTheirs, borderWidth: 1, borderColor: chat.bubbleTheirsBorder, borderRadius: radius.xl, ...tailCorner(false, I18nManager.isRTL), paddingHorizontal: spacing.md, paddingVertical: 8, ...shadows.sm }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 1, 2].map((i) => <Dot key={i} delay={i * 140} />)}
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{label}</Text>
      </View>
    </Animated.View>
  );
}

function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 320, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 320, easing: Easing.inOut(Easing.quad) })), -1, false));
    return () => { v.value = 0; };
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * v.value, transform: [{ translateY: -3 * v.value }] }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textSecondary }, style]} />;
}
