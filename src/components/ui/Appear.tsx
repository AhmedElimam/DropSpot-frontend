import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

/**
 * A ONE-OFF element arriving: one short timed transition of opacity (and, when asked, a small
 * slide or a scale) that runs once at mount on the UI thread and is cancelled at unmount.
 *
 * This is what stands where a Reanimated layout animation (`entering`) used to: those re-lay
 * the tree and are banned by docs/PERFORMANCE.md rule 2. Never wrap a list row in this — rows
 * simply appear. There is no leaving motion: the element goes when it unmounts.
 */
export function Appear({ children, style, delay = 0, duration = 160, rise = 0, from = 1, pointerEvents, accessibilityLabel }: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** ms before it starts. */
  delay?: number;
  duration?: number;
  /** Points it travels: positive comes up from below, negative comes down from above. */
  rise?: number;
  /** The scale it starts at (1 = no scaling). */
  from?: number;
  pointerEvents?: ViewProps['pointerEvents'];
  accessibilityLabel?: string;
}) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(v);
  }, [v, delay, duration]);
  const motion = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: rise * (1 - v.value) }, { scale: from + (1 - from) * v.value }],
  }));
  return <Animated.View pointerEvents={pointerEvents} accessibilityLabel={accessibilityLabel} style={[style, motion]}>{children}</Animated.View>;
}
