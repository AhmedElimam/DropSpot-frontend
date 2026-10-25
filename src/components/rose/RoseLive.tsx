import { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useAmbientMotion } from '@/hooks/useAmbientMotion';
import { useRose } from '@/hooks/useRose';
import type { RoseActivity } from './RoseProps';
import { useRosePictures } from './RoseCostume';
import { ROSE_FRAME, ROSE_JAW_DROP, ROSE_RIG, type RoseLayer } from '@/rose/manifest';

/**
 * مدام روز, alive — her painted portrait (since 2026-10-25, in الناظر's hand), rigged like his:
 * the base carries skin under her brows, eyes and lips, and those parts — cut from the same
 * painting, never drawn by us — are layers, each in its own Animated.View. Every motion is a
 * transform on the UI thread (founder 2026-10-25: «she doesn't move or make reaction or moving
 * her lips when she talks any more»).
 *
 *   always     blinks at irregular intervals (each eye its own). The eyes never slide: each
 *              layer carries its lash line, so a moved eye read as a sly side-eye (founder
 *              2026-10-25 «still same weird ugly expression»)
 *   idle       every 6–12 s one expression: a warm lift of the brows · brows up · a thinking look (one brow
 *              raised, the head tilted) · a nod · a slow sleepy blink. Never a wink.
 *   talking    her lower lip drops and rises in uneven beats while she types, uncovering the
 *              inside of her mouth — the upper lip and the smile stay painted; a light bob
 *   react      a tap, or `reactRose()` from anywhere (a stamp landing): brows up, a double
 *              blink, a hop. Her smile is the painting's own and is never resized.
 *
 * Everything stops while the screen is not focused, while `paused` (the page is scrolling, or
 * she is scrolled out of sight), and under reduced motion (useAmbientMotion).
 */

// The pivot of the whole figure: her chin, in the 400-unit frame the hero sizes by.
const CHIN = { x: 200, y: 392 };

type Expression = 'smile' | 'brows' | 'think' | 'nod' | 'sleepy';
const POOL: Expression[] = ['smile', 'smile', 'smile', 'brows', 'think', 'think', 'nod', 'nod', 'sleepy', 'sleepy'];

// ── reactions from elsewhere (a stamp landing on her desk) ──
const listeners = new Set<() => void>();
/** Make every live portrait on screen react once. */
export function reactRose(): void {
  listeners.forEach((l) => l());
}

const ease = Easing.inOut(Easing.quad);

export const RoseLive = memo(function RoseLive({ size, talking = false, paused = false, activity: _activity = 'cash', style }: { size: number; talking?: boolean; paused?: boolean; activity?: RoseActivity; style?: StyleProp<ViewStyle> }) {
  const rose = useRose();
  const k = size / ROSE_FRAME;
  const kc = size / 400;
  const alive = useAmbientMotion(paused);
  const pictures = useRosePictures();

  const blinkL = useSharedValue(0);
  const blinkR = useSharedValue(0);
  const browL = useSharedValue(0);
  const browR = useSharedValue(0);
  const talk = useSharedValue(0);
  const hop = useSharedValue(1);
  const tilt = useSharedValue(0);
  const float = useSharedValue(0);

  const blinkBoth = useCallback((twice = false, slow = false) => {
    const d = slow ? [420, 520] : [120, 170];
    const one = (v: SharedValue<number>) => {
      const a = [withTiming(1, { duration: d[0], easing: Easing.in(Easing.quad) }), withTiming(0, { duration: d[1], easing: Easing.out(Easing.quad) })];
      v.value = twice ? withSequence(...a, withDelay(90, withTiming(1, { duration: 110 })), withTiming(0, { duration: 160 })) : withSequence(...a);
    };
    one(blinkL);
    one(blinkR);
  }, [blinkL, blinkR]);

  // Blinks: every 2.8–6.4 s, one in five a double.
  useEffect(() => {
    if (!alive) return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => { t = setTimeout(() => { blinkBoth(Math.random() < 0.2); next(); }, 2800 + Math.random() * 3600); };
    next();
    return () => clearTimeout(t);
  }, [alive, blinkBoth]);

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

  // Lips while she types: uneven beats, about five a second, like syllables.
  useEffect(() => {
    if (talking && alive) {
      talk.value = withRepeat(withSequence(
        withTiming(1, { duration: 110, easing: ease }), withTiming(0.25, { duration: 90, easing: ease }),
        withTiming(0.8, { duration: 120, easing: ease }), withTiming(0.1, { duration: 100, easing: ease }),
        withTiming(0.6, { duration: 90, easing: ease }), withTiming(0, { duration: 130, easing: ease }),
      ), -1, false);
    } else { cancelAnimation(talk); talk.value = withTiming(0, { duration: 120 }); }
    return () => cancelAnimation(talk);
  }, [talking, alive, talk]);

  const play = useCallback((e: Expression) => {
    const hold = (v: SharedValue<number>, to: number, inMs: number, holdMs: number, outMs: number) => {
      v.value = withSequence(withTiming(to, { duration: inMs, easing: ease }), withDelay(holdMs, withTiming(0, { duration: outMs, easing: ease })));
    };
    switch (e) {
      case 'smile':
        hold(browL, 0.35, 260, 1600, 380);
        hold(browR, 0.35, 260, 1600, 380);
        break;
      case 'brows':
        hold(browL, 1, 180, 700, 300);
        hold(browR, 1, 180, 700, 300);
        break;
      case 'think':
        hold(browR, 1, 260, 1500, 360);
        hold(tilt, -1.6, 360, 1300, 420);
        break;
      case 'nod':
        tilt.value = withSequence(withTiming(1.4, { duration: 200, easing: ease }), withTiming(-0.8, { duration: 220, easing: ease }), withTiming(0.6, { duration: 200, easing: ease }), withTiming(0, { duration: 240, easing: ease }));
        break;
      case 'sleepy':
        blinkBoth(false, true);
        break;
    }
  }, [browL, browR, tilt, blinkBoth]);

  useEffect(() => {
    if (!alive) return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        if (!talking) play(POOL[Math.floor(Math.random() * POOL.length)]);
        next();
      }, 6000 + Math.random() * 6000);
    };
    next();
    return () => clearTimeout(t);
  }, [alive, talking, play]);

  const lastReact = useRef(0);
  const react = useCallback(() => {
    const now = Date.now();
    if (now - lastReact.current < 600) return;
    lastReact.current = now;
    blinkBoth(true);
    browL.value = withSequence(withTiming(1, { duration: 140 }), withDelay(500, withTiming(0, { duration: 260 })));
    browR.value = withSequence(withTiming(1, { duration: 140 }), withDelay(500, withTiming(0, { duration: 260 })));
    hop.value = withSequence(withTiming(1.06, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 7, stiffness: 180 }));
    tilt.value = withSequence(withTiming(1.6, { duration: 90 }), withTiming(-1.6, { duration: 140 }), withTiming(0.8, { duration: 120 }), withTiming(0, { duration: 160 }));
  }, [blinkBoth, browL, browR, hop, tilt]);
  useEffect(() => {
    listeners.add(react);
    return () => { listeners.delete(react); };
  }, [react]);

  // The parts: each layer at its box in the frame, turning and scaling about its pivot.
  const eyeL = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(0.16, 1 - 0.84 * blinkL.value) }] }));
  const eyeR = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(0.16, 1 - 0.84 * blinkR.value) }] }));
  const brL = useAnimatedStyle(() => ({ transform: [{ translateY: -10 * k * browL.value }, { rotate: `${-4 * browL.value}deg` }] }));
  const brR = useAnimatedStyle(() => ({ transform: [{ translateY: -10 * k * browR.value }, { rotate: `${4 * browR.value}deg` }] }));
  // Talking: only the lower lip drops (and rises), uncovering the still mouth_in layer behind it.
  const lipLower = useAnimatedStyle(() => ({ transform: [{ translateY: ROSE_JAW_DROP * k * talk.value }] }));
  const whole = useAnimatedStyle(() => ({ transform: [{ translateY: float.value - 1.2 * talk.value }, { scale: hop.value }, { rotate: `${tilt.value}deg` }] }));

  const layer = (name: RoseLayer, st: object) => {
    const { box: [x, y, w, h], pivot: [px, py], source } = ROSE_RIG[name];
    return (
      <Animated.View key={name} pointerEvents="none" style={[{ position: 'absolute', left: x * k, top: y * k, width: w * k, height: h * k, transformOrigin: [px * w * k, py * h * k, 0] }, st]}>
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="fill" />
      </Animated.View>
    );
  };

  return (
    <Pressable onPress={react} accessibilityRole="image" accessibilityLabel={rose.name} style={style}>
      {/* direction 'ltr': under the app's forced RTL an absolute `left` is measured from the RIGHT, which put
          every part in the mirror spot — brows swapped, eyes off, the lips ~27 pt off-centre (founder
          2026-10-25: «still same weird ugly expression»). الناظر's face is pinned the same way. */}
      <Animated.View style={[{ width: size, height: size, direction: 'ltr', transformOrigin: [CHIN.x * kc, CHIN.y * kc, 0] }, whole]}>
        <Image source={pictures.liveBase} style={StyleSheet.absoluteFill} contentFit="contain" />
        {layer('brow_l', brL)}
        {layer('brow_r', brR)}
        {layer('eye_l', eyeL)}
        {layer('eye_r', eyeR)}
        {layer('mouth_in', {})}
        {layer('lip_lower', lipLower)}
      </Animated.View>
    </Pressable>
  );
});
