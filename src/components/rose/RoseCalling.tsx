import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { colors } from '@/theme/index';
import { RosePortrait } from './RoseStamp';

/**
 * مدام روز on the home shortcut, CALLING you when she has something waiting (founder
 * 2026-10-08: «when she's got something urgent on her count, an animation of waving or
 * something on the home screen»). Every few seconds: a hand pops up beside her and waves,
 * she gives a small hop, and a ring pulses out around her frame — then she rests. With
 * nothing waiting she is the still portrait.
 *
 * A burst, not a loop: about a second and a half of motion every five, and none at all while
 * the screen is not in front of you or the phone asks for reduced motion — on a mid-range
 * Android every animated frame costs (see RoseLive).
 */
const EVERY_MS = 5200;

export function RoseCalling({ size, calling }: { size: number; calling: boolean }) {
  const focused = useIsFocused();
  const still = useReducedMotion();
  const live = calling && focused && !still;

  const wave = useSharedValue(0);  // hand angle, −1 … 1
  const hand = useSharedValue(0);  // hand shown 0 … 1
  const hop = useSharedValue(1);   // portrait scale
  const ring = useSharedValue(0);  // 0 → 1 pulse

  useEffect(() => {
    if (!live) {
      cancelAnimation(wave); cancelAnimation(hand); cancelAnimation(hop); cancelAnimation(ring);
      wave.value = 0; hand.value = 0; hop.value = 1; ring.value = 0;
      return;
    }
    const ease = Easing.inOut(Easing.quad);
    const burst = () => {
      hand.value = withSequence(withSpring(1, { damping: 11, stiffness: 220 }), withDelay(1150, withTiming(0, { duration: 220 })));
      wave.value = withSequence(
        withTiming(1, { duration: 150, easing: ease }), withTiming(-1, { duration: 220, easing: ease }),
        withTiming(1, { duration: 220, easing: ease }), withTiming(-1, { duration: 220, easing: ease }),
        withTiming(0.6, { duration: 200, easing: ease }), withTiming(0, { duration: 180, easing: ease }),
      );
      hop.value = withSequence(withTiming(1.08, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 7, stiffness: 190 }));
      ring.value = 0;
      ring.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
    };
    const first = setTimeout(burst, 700);
    const every = setInterval(burst, EVERY_MS);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [live, wave, hand, hop, ring]);

  const handSt = useAnimatedStyle(() => ({
    opacity: hand.value,
    transform: [{ scale: 0.4 + 0.6 * hand.value }, { rotate: `${22 * wave.value}deg` }],
  }));
  const hopSt = useAnimatedStyle(() => ({ transform: [{ scale: hop.value }] }));
  const ringSt = useAnimatedStyle(() => ({
    opacity: ring.value > 0 && ring.value < 1 ? 0.55 * (1 - ring.value) : 0,
    transform: [{ scale: 0.92 + 0.38 * ring.value }],
  }));

  return (
    <View style={{ width: size, height: size }}>
      {calling ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderWidth: 3, borderColor: colors.accent }, ringSt]} />
      ) : null}
      <Animated.View style={hopSt}>
        <RosePortrait size={size} nod={false} />
      </Animated.View>
      {calling ? (
        // Her hand, beside her shoulder, pivoting at the wrist.
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', bottom: -2, start: -12, transformOrigin: ['50%', '85%', 0] }, handSt]}>
          <Text style={{ fontSize: size * 0.38 }} accessibilityElementsHidden importantForAccessibility="no">👋🏽</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
