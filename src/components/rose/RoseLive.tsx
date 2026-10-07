import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Svg, { G, Ellipse, Circle, Path } from 'react-native-svg';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { useRose } from '@/hooks/useRose';

/**
 * مدام روز, alive — the app's copy of the landing page's figure (partials/rose-live), founder
 * 2026-10-07: «her eyes moving automatically, blinking, and giving reactions».
 *
 * The portrait is a still picture WITHOUT the parts that move (assets/…/madam-rose-live-base,
 * rendered from the site's madam-rose.svg with the rm-look / rm-lid / rm-lips / rm-hoop groups
 * removed), and those parts are drawn back on top as small vector layers, each in its own
 * Animated.View — so every motion is a plain view transform (UI thread, no SVG re-render).
 * Base + parts was checked against the full artwork: pixel-identical at rest.
 *
 *   eyes   glance around on their own, every few seconds (the landing's rm-glance), and blink
 *          at irregular intervals, sometimes twice (rm-blink + the lid dropping, rm-lid)
 *   lips   move while she is `talking` (her greeting typing out — rm-talk)
 *   hoops  swing, out of step with each other (rm-swing)
 *   react  a tap on her, or `reactRose()` from anywhere (a stamp landing): a quick blink,
 *          eyes to the viewer, a little hop, the hoops jiggle, a short smile
 *
 * Everything stops while the screen is not focused, and nothing loops when the phone asks
 * for reduced motion.
 */

// The artwork's own frame: the 400-unit drawing, medallion scaled 0.9 around (200, 212).
const FRAME = 'translate(200 212) scale(0.9) translate(-200 -200)';
const out = (x: number, y: number) => ({ x: 200 + 0.9 * (x - 200), y: 212 + 0.9 * (y - 200) });
// Pivots (the landing's transform-origins), in the drawing's outer units.
const EYE_O = out(200, 202.5);
const LID_O = out(200, 195.7);
const LIPS_O = out(200, 237.4);
const HOOP_L = out(146, 226);
const HOOP_R = out(254, 226);
// Where her eyes go when she glances (inner units, the landing's rm-glance) — and down at her bubble.
const GLANCES: [number, number][] = [[0, 0], [-2.4, 0.8], [0, 0], [2, 0.4], [0, 1.4], [0, 0], [-1.6, 1.2], [2.2, 0]];

const BASE = require('../../../assets/images/rose/madam-rose-live-base.webp');

// ── reactions from elsewhere (a stamp landing on her desk) ──
const listeners = new Set<() => void>();
/** Make every live portrait on screen react once. */
export function reactRose(): void {
  listeners.forEach((l) => l());
}

export function RoseLive({ size, talking = false, style }: { size: number; talking?: boolean; style?: StyleProp<ViewStyle> }) {
  const rose = useRose();
  const focused = useIsFocused();
  const still = useReducedMotion();
  const k = size / 400; // drawing unit → points
  const alive = focused && !still;

  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const blink = useSharedValue(0); // 0 open … 1 shut
  const talk = useSharedValue(0);
  const smile = useSharedValue(0);
  const hopL = useSharedValue(0);
  const hopR = useSharedValue(0);
  const jig = useSharedValue(0);
  const hop = useSharedValue(1);

  const blinkOnce = useCallback((twice = false) => {
    const one = [withTiming(1, { duration: 120, easing: Easing.in(Easing.quad) }), withTiming(0, { duration: 170, easing: Easing.out(Easing.quad) })];
    blink.value = twice ? withSequence(...one, withDelay(90, withTiming(1, { duration: 110 })), withTiming(0, { duration: 160 })) : withSequence(...one);
  }, [blink]);

  // Blinks: every 2.8–6.4 s, one in five a double.
  useEffect(() => {
    if (!alive) return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => { blinkOnce(Math.random() < 0.2); next(); }, 2800 + Math.random() * 3600);
    };
    next();
    return () => clearTimeout(t);
  }, [alive, blinkOnce]);

  // Glances: a new place every 1.6–3.4 s, a quick saccade there.
  useEffect(() => {
    if (!alive) { gx.value = withTiming(0); gy.value = withTiming(0); return; }
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        i = (i + 1) % GLANCES.length;
        // While she talks she looks at what she is saying — down at her bubble.
        const [x, y] = talking ? [0, 1.4] : GLANCES[i];
        gx.value = withTiming(x * 0.9, { duration: 170, easing: Easing.out(Easing.quad) });
        gy.value = withTiming(y * 0.9, { duration: 170, easing: Easing.out(Easing.quad) });
        next();
      }, 1600 + Math.random() * 1800);
    };
    next();
    return () => clearTimeout(t);
  }, [alive, talking, gx, gy]);

  // Hoops swing, out of step.
  useEffect(() => {
    if (!alive) { cancelAnimation(hopL); cancelAnimation(hopR); return; }
    const swing = (sv: typeof hopL, delay: number) => {
      sv.value = -1;
      sv.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1750, easing: Easing.inOut(Easing.sin) }), -1, true));
    };
    swing(hopL, 0);
    swing(hopR, 850);
    return () => { cancelAnimation(hopL); cancelAnimation(hopR); };
  }, [alive, hopL, hopR]);

  // Lips while she talks.
  useEffect(() => {
    if (talking && !still) talk.value = withRepeat(withTiming(1, { duration: 190, easing: Easing.inOut(Easing.quad) }), -1, true);
    else talk.value = withTiming(0, { duration: 120 });
  }, [talking, still, talk]);

  // A reaction: blink, eyes to you, a hop, the hoops jiggle, a short smile.
  const lastReact = useRef(0);
  const react = useCallback(() => {
    const now = Date.now();
    if (now - lastReact.current < 600) return;
    lastReact.current = now;
    blinkOnce(true);
    gx.value = withTiming(0, { duration: 120 });
    gy.value = withTiming(0, { duration: 120 });
    hop.value = withSequence(withTiming(1.06, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 7, stiffness: 180 }));
    jig.value = withSequence(withTiming(1, { duration: 90 }), withTiming(-1, { duration: 140 }), withTiming(0.6, { duration: 120 }), withTiming(0, { duration: 160 }));
    smile.value = withSequence(withTiming(1, { duration: 160 }), withDelay(700, withTiming(0, { duration: 260 })));
  }, [blinkOnce, gx, gy, hop, jig, smile]);
  useEffect(() => {
    listeners.add(react);
    return () => { listeners.delete(react); };
  }, [react]);

  // Pivots in points. Static (plain style) — only the transforms animate.
  const at = (o: { x: number; y: number }) => ({ transformOrigin: [o.x * k, o.y * k, 0] as [number, number, number] });
  const eyes = useAnimatedStyle(() => ({
    transform: [{ translateX: gx.value * k }, { translateY: gy.value * k }, { scaleY: 1 - 0.92 * blink.value }],
  }));
  const lids = useAnimatedStyle(() => ({
    transform: [{ translateY: 4.95 * k * blink.value }, { scaleY: 1 - 0.45 * blink.value }],
  }));
  const lips = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + 0.08 * smile.value }, { scaleY: 1 + 0.32 * talk.value - 0.12 * smile.value }],
  }));
  const hoopL = useAnimatedStyle(() => ({ transform: [{ rotate: `${7 * hopL.value + 16 * jig.value}deg` }] }));
  const hoopR = useAnimatedStyle(() => ({ transform: [{ rotate: `${7 * hopR.value - 16 * jig.value}deg` }] }));
  const whole = useAnimatedStyle(() => ({ transform: [{ scale: hop.value }] }));

  const layer = (children: React.ReactNode, st: object, origin: object) => (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, origin, st]}>
      <Svg width={size} height={size} viewBox="0 0 400 400"><G transform={FRAME}>{children}</G></Svg>
    </Animated.View>
  );

  return (
    <Pressable onPress={react} accessibilityRole="image" accessibilityLabel={rose.name} style={style}>
      <Animated.View style={[{ width: size, height: size }, whole]}>
        <Image source={BASE} style={StyleSheet.absoluteFill} contentFit="contain" />
        {layer(<>
          <Ellipse cx={180} cy={201} rx={6.4} ry={7.6} fill="#1A1F38" />
          <Circle cx={182.2} cy={198.2} r={2.1} fill="#FFFFFF" />
          <Circle cx={178} cy={204.2} r={0.9} fill="#FFFFFF" fillOpacity={0.7} />
          <Ellipse cx={220} cy={201} rx={6.4} ry={7.6} fill="#1A1F38" />
          <Circle cx={222.2} cy={198.2} r={2.1} fill="#FFFFFF" />
          <Circle cx={218} cy={204.2} r={0.9} fill="#FFFFFF" fillOpacity={0.7} />
        </>, eyes, at(EYE_O))}
        {layer(<G fill="none" stroke="#1A1F38" strokeLinecap="round">
          <Path d="M169 197.5 Q180 189 191 197.5" strokeWidth={2.8} />
          <Path d="M169 197.5 q-3 -1 -5 -3.4" strokeWidth={2.4} />
          <Path d="M209 197.5 Q220 189 231 197.5" strokeWidth={2.8} />
          <Path d="M231 197.5 q3 -1 5 -3.4" strokeWidth={2.4} />
        </G>, lids, at(LID_O))}
        {layer(<>
          <Path d="M186 240 Q193 236 200 239 Q207 236 214 240 Q200 251 186 240 Z" fill="#B8323F" />
          <Ellipse cx={205} cy={244.5} rx={4} ry={1.3} fill="#FFFFFF" fillOpacity={0.45} />
        </>, lips, at(LIPS_O))}
        {layer(<>
          <Circle cx={146} cy={236} r={10} fill="none" stroke="#C9A227" strokeWidth={4} />
          <Path d="M139 231 a10 10 0 0 1 5 -4.5" fill="none" stroke="#FFF3C4" strokeWidth={1.6} strokeLinecap="round" />
        </>, hoopL, at(HOOP_L))}
        {layer(<>
          <Circle cx={254} cy={236} r={10} fill="none" stroke="#C9A227" strokeWidth={4} />
          <Path d="M247 231 a10 10 0 0 1 5 -4.5" fill="none" stroke="#FFF3C4" strokeWidth={1.6} strokeLinecap="round" />
        </>, hoopR, at(HOOP_R))}
      </Animated.View>
    </Pressable>
  );
}
