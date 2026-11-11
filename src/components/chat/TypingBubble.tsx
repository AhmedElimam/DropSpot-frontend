import { useEffect } from 'react';
import { View, Text, I18nManager } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { Appear } from '@/components/ui/Appear';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { chat } from '@/theme/chat';
import { bubbleSide, tailCorner } from '@/components/chat/ChatBubble';

/**
 * «يكتب…» as a small bubble at the foot of the room — three dots breathing in turn, the way
 * every messenger the family already uses says it — beside the header line. Unmounts (and
 * cancels its motion) the moment nobody is typing, so an idle room animates nothing.
 *
 * The dots are a BURST, not a loop (docs/PERFORMANCE.md rule 1): a typing frame keeps the
 * bubble up for about six seconds, so they breathe for that long and then rest.
 */
const BEAT_MS = 320;
const BEATS = 10; // ≈ 6.4 s
const EASE = Easing.inOut(Easing.quad);

export function TypingBubble({ label }: { label: string }) {
  return (
    <Appear duration={160} rise={-8} style={{ alignSelf: bubbleSide(false, I18nManager.isRTL), marginTop: 6, marginBottom: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: chat.bubbleTheirs, borderWidth: 1, borderColor: chat.bubbleTheirsBorder, borderRadius: radius.xl, ...tailCorner(false, I18nManager.isRTL), paddingHorizontal: spacing.md, paddingVertical: 8, ...shadows.sm }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 1, 2].map((i) => <Dot key={i} delay={i * 140} />)}
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{label}</Text>
      </View>
    </Appear>
  );
}

function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    const beats = [];
    for (let i = 0; i < BEATS; i++) beats.push(withTiming(1, { duration: BEAT_MS, easing: EASE }), withTiming(0, { duration: BEAT_MS, easing: EASE }));
    v.value = withDelay(delay, withSequence(...beats));
    return () => cancelAnimation(v);
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * v.value, transform: [{ translateY: -3 * v.value }] }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textSecondary }, style]} />;
}
