import { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { useAmbientMotion } from '@/hooks/useAmbientMotion';
import { useRose } from '@/hooks/useRose';
import type { RoseActivity } from './RoseProps';
import { useRosePictures } from './RoseCostume';

/**
 * مدام روز, alive — her painted portrait (since 2026-10-25, in الناظر's hand: founder «we want
 * our art style like el nazer now»). The picture is ONE painting, so nothing inside her face
 * is a separate layer any more; what moves is the whole figure, every motion a transform on
 * the UI thread:
 *
 *   always     she breathes: a slow float, every 6–9 s
 *   idle       every 6–12 s a nod, or a small tilt of the head and a settle back
 *   talking    a light bob while she types
 *   react      a tap, or `reactRose()` from anywhere (a stamp landing): a hop and a jiggle
 *
 * Everything stops while the screen is not focused, while `paused` (the page is scrolling, or
 * she is scrolled out of sight), and under reduced motion (useAmbientMotion). On a mid-range
 * Android every frame she moves is a commit of the whole page — so she moves only while she
 * can be seen and the page is still.
 */

// The pivot: her chin, in the 400-unit frame of the artwork.
const CHIN = { x: 200, y: 392 };

// ── reactions from elsewhere (a stamp landing on her desk) ──
const listeners = new Set<() => void>();
/** Make every live portrait on screen react once. */
export function reactRose(): void {
  listeners.forEach((l) => l());
}

const ease = Easing.inOut(Easing.quad);

export const RoseLive = memo(function RoseLive({ size, talking = false, paused = false, activity: _activity = 'cash', style }: { size: number; talking?: boolean; paused?: boolean; activity?: RoseActivity; style?: StyleProp<ViewStyle> }) {
  const rose = useRose();
  const k = size / 400;
  // In front of you, app active, motion allowed, page still (founder 2026-10-09: light on every phone).
  const alive = useAmbientMotion(paused);
  const pictures = useRosePictures();

  const float = useSharedValue(0);
  const tilt = useSharedValue(0);
  const hop = useSharedValue(1);
  const bob = useSharedValue(0);

  // Breathing: a burst, then quiet, never a loop.
  useEffect(() => {
    if (!alive) { cancelAnimation(float); float.value = withTiming(0); return; }
    let t: ReturnType<typeof setTimeout>;
    const burst = () => {
      float.value = withSequence(
        withTiming(-4, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      );
      t = setTimeout(burst, 6000 + Math.random() * 3000);
    };
    t = setTimeout(burst, 900);
    return () => { clearTimeout(t); cancelAnimation(float); };
  }, [alive, float]);

  // Idle: a nod or a tilt every 6–12 s, never while she is typing.
  useEffect(() => {
    if (!alive) { cancelAnimation(tilt); tilt.value = withTiming(0); return; }
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        if (!talking) {
          if (Math.random() < 0.5) {
            tilt.value = withSequence(withTiming(1.4, { duration: 200, easing: ease }), withTiming(-0.8, { duration: 220, easing: ease }), withTiming(0.6, { duration: 200, easing: ease }), withTiming(0, { duration: 240, easing: ease }));
          } else {
            tilt.value = withSequence(withTiming(-1.8, { duration: 420, easing: ease }), withDelay(1200, withSpring(0, { damping: 9, stiffness: 160 })));
          }
        }
        next();
      }, 6000 + Math.random() * 6000);
    };
    next();
    return () => { clearTimeout(t); cancelAnimation(tilt); };
  }, [alive, talking, tilt]);

  useEffect(() => {
    if (talking && alive) bob.value = withRepeat(withTiming(1, { duration: 260, easing: ease }), -1, true);
    else { cancelAnimation(bob); bob.value = withTiming(0, { duration: 120 }); }
    return () => cancelAnimation(bob);
  }, [talking, alive, bob]);

  const lastReact = useRef(0);
  const react = useCallback(() => {
    const now = Date.now();
    if (now - lastReact.current < 600) return;
    lastReact.current = now;
    hop.value = withSequence(withTiming(1.06, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 7, stiffness: 180 }));
    tilt.value = withSequence(withTiming(1.6, { duration: 90 }), withTiming(-1.6, { duration: 140 }), withTiming(0.8, { duration: 120 }), withTiming(0, { duration: 160 }));
  }, [hop, tilt]);
  useEffect(() => {
    listeners.add(react);
    return () => { listeners.delete(react); };
  }, [react]);

  const whole = useAnimatedStyle(() => ({ transform: [{ translateY: float.value - 1.2 * bob.value }, { scale: hop.value }, { rotate: `${tilt.value}deg` }] }));

  return (
    <Pressable onPress={react} accessibilityRole="image" accessibilityLabel={rose.name} style={style}>
      <Animated.View style={[{ width: size, height: size, transformOrigin: [CHIN.x * k, CHIN.y * k, 0] }, whole]}>
        <Image source={pictures.liveBase} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
    </Pressable>
  );
});
