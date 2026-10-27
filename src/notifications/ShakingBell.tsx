import { useEffect, useRef } from 'react';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Icon } from '@/components/ui/Icon';
import { useInAppNotice } from './inAppNotice';

/**
 * The header bell, which rings when a notification arrives (founder 2026-10-27: «on new
 * notification we want the bell of notification to shake»). Swings from its top like a real
 * bell, a few dying swings over ~0.8 s, then still — a burst, never a loop. Nothing under
 * reduced motion.
 */
export function ShakingBell({ size, color }: { size: number; color: string }) {
  const pulse = useInAppNotice((s) => s.bellPulse);
  const first = useRef(pulse);
  const reduced = useReducedMotion();
  const swing = useSharedValue(0);

  useEffect(() => {
    if (pulse === first.current || reduced) return;
    first.current = pulse;
    cancelAnimation(swing);
    const e = Easing.inOut(Easing.sin);
    swing.value = withSequence(
      ...[18, -16, 13, -10, 7, -4, 2, 0].map((d, i) => withTiming(d, { duration: i === 0 ? 90 : 105, easing: e })),
    );
  }, [pulse, reduced, swing]);

  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.value}deg` }] }));
  return (
    <Animated.View style={[{ transformOrigin: [size / 2, 1, 0] }, st]}>
      <Icon name="bell" size={size} color={color} outline />
    </Animated.View>
  );
}
