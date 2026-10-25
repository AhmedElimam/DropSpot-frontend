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
import { ROSE_FRAME, ROSE_RIG, type RoseLayer } from '@/rose/manifest';

/**
 * مدام روز, alive — her painted portrait (since 2026-10-25, in الناظر's hand), rigged like his:
 * the base carries skin under her brows, eyes and lips, and those parts — cut from the same
 * painting, never drawn by us — are layers, each in its own Animated.View. Every motion is a
 * transform on the UI thread (founder 2026-10-25: «she doesn't move or make reaction or moving
 * her lips when she talks any more»).
 *
 *   always     eyes glance on their own; blinks at irregular intervals (each eye its own)
 *   idle       every 6–12 s one expression: a smile · brows up · a thinking look (eyes up,
 *              one brow raised) · a nod · a slow sleepy blink. Never a wink.
 *   talking    lips open and close in uneven beats while she types; a light bob
 *   at work    `activity` — she keeps looking down at what she reads
 *   react      a tap, or `reactRose()` from anywhere (a stamp landing): brows up, a double
 *              blink, eyes to you, a hop, a smile
 *
 * Everything stops while the screen is not focused, while `paused` (the page is scrolling, or
 * she is scrolled out of sight), and under reduced motion (useAmbientMotion).
 */

// The pivot of the whole figure: her chin, in the 400-unit frame the hero sizes by.
const CHIN = { x: 200, y: 392 };

// Where her eyes wander (pt in the 1200 frame). At work, she keeps looking down at what she holds.
const GLANCES: [number, number][] = [[0, 0], [-7, 2], [0, 0], [6, 1], [0, 4], [0, 0], [-5, 3], [6, 0]];
const AT_WORK: [number, number][] = [[0, 6], [2, 7], [0, 6], [-2, 7], [0, 0], [0, 6], [5, 1]];

type Expression = 'smile' | 'brows' | 'think' | 'nod' | 'sleepy';
const POOL: Expression[] = ['smile', 'smile', 'smile', 'brows', 'think', 'think', 'nod', 'nod', 'sleepy', 'sleepy'];

// ── reactions from elsewhere (a stamp landing on her desk) ──
const listeners = new Set<() => void>();
/** Make every live portrait on screen react once. */
export function reactRose(): void {
  listeners.forEach((l) => l());
}

const ease = Easing.inOut(Easing.quad);

export const RoseLive = memo(function RoseLive({ size, talking = false, paused = false, activity = 'cash', style }: { size: number; talking?: boolean; paused?: boolean; activity?: RoseActivity; style?: StyleProp<ViewStyle> }) {
  const rose = useRose();
  const k = size / ROSE_FRAME;
  const kc = size / 400;
  const alive = useAmbientMotion(paused);
  const working = activity !== 'cash';
  const pictures = useRosePictures();

  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const blinkL = useSharedValue(0);
  const blinkR = useSharedValue(0);
  const browL = useSharedValue(0);
  const browR = useSharedValue(0);
  const talk = useSharedValue(0);
  const smile = useSharedValue(0);
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

  // Glances.
  useEffect(() => {
    if (!alive) { gx.value = withTiming(0); gy.value = withTiming(0); return; }
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const list = working ? AT_WORK : GLANCES;
    const next = () => {
      t = setTimeout(() => {
        i = (i + 1) % list.length;
        const [x, y] = talking ? [0, 4] : list[i];
        gx.value = withTiming(x, { duration: 170, easing: Easing.out(Easing.quad) });
        gy.value = withTiming(y, { duration: 170, easing: Easing.out(Easing.quad) });
        next();
      }, 1600 + Math.random() * 1800);
    };
    next();
    return () => clearTimeout(t);
  }, [alive, talking, working, gx, gy]);

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
        hold(smile, 1, 260, 1600, 380);
        hold(browL, 0.35, 260, 1600, 380);
        hold(browR, 0.35, 260, 1600, 380);
        break;
      case 'brows':
        hold(browL, 1, 180, 700, 300);
        hold(browR, 1, 180, 700, 300);
        break;
      case 'think':
        gx.value = withTiming(-6, { duration: 260 });
        gy.value = withTiming(-5, { duration: 260 });
        hold(browR, 1, 260, 1500, 360);
        hold(tilt, -1.6, 360, 1300, 420);
        break;
      case 'nod':
        tilt.value = withSequence(withTiming(1.4, { duration: 200, easing: ease }), withTiming(-0.8, { duration: 220, easing: ease }), withTiming(0.6, { duration: 200, easing: ease }), withTiming(0, { duration: 240, easing: ease }));
        hold(smile, 0.7, 200, 500, 300);
        break;
      case 'sleepy':
        blinkBoth(false, true);
        break;
    }
  }, [smile, browL, browR, gx, gy, tilt, blinkBoth]);

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
    gx.value = withTiming(0, { duration: 120 });
    gy.value = withTiming(0, { duration: 120 });
    browL.value = withSequence(withTiming(1, { duration: 140 }), withDelay(500, withTiming(0, { duration: 260 })));
    browR.value = withSequence(withTiming(1, { duration: 140 }), withDelay(500, withTiming(0, { duration: 260 })));
    hop.value = withSequence(withTiming(1.06, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 7, stiffness: 180 }));
    tilt.value = withSequence(withTiming(1.6, { duration: 90 }), withTiming(-1.6, { duration: 140 }), withTiming(0.8, { duration: 120 }), withTiming(0, { duration: 160 }));
    smile.value = withSequence(withTiming(1, { duration: 160 }), withDelay(800, withTiming(0, { duration: 260 })));
  }, [blinkBoth, gx, gy, browL, browR, hop, tilt, smile]);
  useEffect(() => {
    listeners.add(react);
    return () => { listeners.delete(react); };
  }, [react]);

  // The parts: each layer at its box in the frame, turning and scaling about its pivot.
  const eyeL = useAnimatedStyle(() => ({ transform: [{ translateX: gx.value * k }, { translateY: gy.value * k }, { scaleY: Math.max(0.1, 1 - 0.9 * blinkL.value) }] }));
  const eyeR = useAnimatedStyle(() => ({ transform: [{ translateX: gx.value * k }, { translateY: gy.value * k }, { scaleY: Math.max(0.1, 1 - 0.9 * blinkR.value) }] }));
  const brL = useAnimatedStyle(() => ({ transform: [{ translateY: -10 * k * browL.value }, { rotate: `${-4 * browL.value}deg` }] }));
  const brR = useAnimatedStyle(() => ({ transform: [{ translateY: -10 * k * browR.value }, { rotate: `${4 * browR.value}deg` }] }));
  // Talking: the jaw drops from the upper lip (the pivot sits near the top), the mouth widens a little; a smile scales it up.
  const lips = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 + 0.06 * smile.value - 0.04 * talk.value }, { scaleY: 1 + 0.34 * talk.value + 0.08 * smile.value }] }));
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
      <Animated.View style={[{ width: size, height: size, transformOrigin: [CHIN.x * kc, CHIN.y * kc, 0] }, whole]}>
        <Image source={pictures.liveBase} style={StyleSheet.absoluteFill} contentFit="contain" />
        {layer('brow_l', brL)}
        {layer('brow_r', brR)}
        {layer('eye_l', eyeL)}
        {layer('eye_r', eyeR)}
        {layer('lips', lips)}
      </Animated.View>
    </Pressable>
  );
});
