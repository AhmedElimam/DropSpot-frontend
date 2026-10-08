import { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Svg, { G, Ellipse, Circle, Path } from 'react-native-svg';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { useRose } from '@/hooks/useRose';
import { RoseProps, type RoseActivity } from './RoseProps';

/**
 * مدام روز, alive — the app's copy of the landing page's figure (partials/rose-live), and more
 * of a person than the landing has room for (founder 2026-10-08: «more human expressions, like
 * yawning … be creative; she should feel alive»).
 *
 * The portrait is a still picture WITHOUT the parts that move (assets/…/madam-rose-live-base:
 * the site's madam-rose.svg minus rm-look / rm-lid / rm-lips / rm-hoop and the two brows —
 * checked pixel-identical with the parts drawn back), and those parts are vector layers, each
 * in its own Animated.View — every motion a view transform on the UI thread.
 *
 *   always     eyes glance on their own; blinks at irregular intervals (each eye its own lid);
 *              hoops swing out of step; lips move while she `talking`
 *   idle       every 6–12 s one expression: a smile · brows up · a thinking look (eyes up,
 *              one brow raised, lips pressed) · a nod · a slow sleepy blink · drowsing (eyes
 *              sink half shut, head droops, then she perks up) · and, at most once in 40 s, a
 *              yawn (mouth opens wide, eyes squeeze, she leans back). Never a wink.
 *   at work    `activity` puts something in her hands (RoseProps) — and she reads it: her eyes
 *              keep going down to the ledger, the sheet, the slip
 *   react      a tap, or `reactRose()` from anywhere (a stamp landing): brows up, a double
 *              blink, eyes to you, a hop, hoops jiggle, a smile
 *
 * Everything stops while the screen is not focused, while `paused` (the page is scrolling, or
 * she is scrolled out of sight), and under reduced motion. On a mid-range Android every frame
 * she moves is a commit of the whole page (founder 2026-10-08: «slow, and the phone heats up
 * scrolling her tab») — so she only moves while she can be seen and the page is still.
 */

// The artwork's frame: the 400-unit drawing, medallion scaled 0.9 around (200, 212).
const FRAME = 'translate(200 212) scale(0.9) translate(-200 -200)';
const out = (x: number, y: number) => ({ x: 200 + 0.9 * (x - 200), y: 212 + 0.9 * (y - 200) });
const EYE_L = out(180, 202.5);
const EYE_R = out(220, 202.5);
const LID_L = out(178, 195.7);
const LID_R = out(222, 195.7);
const BROW_L = out(180, 178);
const BROW_R = out(220, 178);
const LIPS = out(200, 237.4);
const MOUTH = out(200, 236);
const HOOP_L = out(146, 226);
const HOOP_R = out(254, 226);
const CHIN = { x: 200, y: 392 };

// Where her eyes wander (inner units). At work, she keeps looking down at what she holds.
const GLANCES: [number, number][] = [[0, 0], [-2.4, 0.8], [0, 0], [2, 0.4], [0, 1.4], [0, 0], [-1.6, 1.2], [2.2, 0]];
const AT_WORK: [number, number][] = [[0, 2.2], [0.6, 2.4], [0, 2.2], [-0.8, 2.3], [0, 0], [0, 2.2], [1.6, 0.4]];

// No wink (founder 2026-10-08: «no winking — just feeling sleepy or something»).
type Expression = 'smile' | 'brows' | 'think' | 'nod' | 'sleepy' | 'drowsy' | 'yawn';
const POOL: Expression[] = ['smile', 'smile', 'smile', 'brows', 'think', 'think', 'nod', 'nod', 'sleepy', 'sleepy', 'drowsy', 'drowsy', 'yawn'];

const BASE = require('../../../assets/images/rose/madam-rose-live-base.webp');

// ── reactions from elsewhere (a stamp landing on her desk) ──
const listeners = new Set<() => void>();
/** Make every live portrait on screen react once. */
export function reactRose(): void {
  listeners.forEach((l) => l());
}

const ease = Easing.inOut(Easing.quad);

export const RoseLive = memo(function RoseLive({ size, talking = false, paused = false, activity = 'cash', style }: { size: number; talking?: boolean; paused?: boolean; activity?: RoseActivity; style?: StyleProp<ViewStyle> }) {
  const rose = useRose();
  const focused = useIsFocused();
  const still = useReducedMotion();
  const k = size / 400;
  const alive = focused && !still && !paused;
  const working = activity !== 'cash';

  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const blinkL = useSharedValue(0);
  const blinkR = useSharedValue(0);
  const wide = useSharedValue(0);
  const browL = useSharedValue(0);
  const browR = useSharedValue(0);
  const talk = useSharedValue(0);
  const smile = useSharedValue(0);
  const press = useSharedValue(0);
  const yawn = useSharedValue(0);
  const hopL = useSharedValue(0);
  const hopR = useSharedValue(0);
  const jig = useSharedValue(0);
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

  // Glances: a new place every 1.6–3.4 s.
  useEffect(() => {
    if (!alive) { gx.value = withTiming(0); gy.value = withTiming(0); return; }
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const list = working ? AT_WORK : GLANCES;
    const next = () => {
      t = setTimeout(() => {
        i = (i + 1) % list.length;
        const [x, y] = talking ? [0, 1.4] : list[i];
        gx.value = withTiming(x * 0.9, { duration: 170, easing: Easing.out(Easing.quad) });
        gy.value = withTiming(y * 0.9, { duration: 170, easing: Easing.out(Easing.quad) });
        next();
      }, 1600 + Math.random() * 1800);
    };
    next();
    return () => clearTimeout(t);
  }, [alive, talking, working, gx, gy]);

  // A slow breath: she floats a few points up and back, so the desk feels occupied.
  useEffect(() => {
    if (!alive) { cancelAnimation(float); return; }
    float.value = withRepeat(withTiming(-5, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => { cancelAnimation(float); };
  }, [alive, float]);

  // Hoops swing, out of step.
  useEffect(() => {
    if (!alive) { cancelAnimation(hopL); cancelAnimation(hopR); return; }
    const swing = (sv: SharedValue<number>, delay: number) => {
      sv.value = -1;
      sv.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1750, easing: Easing.inOut(Easing.sin) }), -1, true));
    };
    swing(hopL, 0);
    swing(hopR, 850);
    return () => { cancelAnimation(hopL); cancelAnimation(hopR); };
  }, [alive, hopL, hopR]);

  // Lips while she talks.
  useEffect(() => {
    if (talking && !still) talk.value = withRepeat(withTiming(1, { duration: 190, easing: ease }), -1, true);
    else talk.value = withTiming(0, { duration: 120 });
  }, [talking, still, talk]);

  // One expression at a time.
  const lastYawn = useRef(0);
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
        hold(wide, 1, 180, 700, 300);
        break;
      case 'drowsy': {
        // Lids sink half shut and the head droops … then she catches herself: a quick blink, brows up.
        const sink = (v: SharedValue<number>) => {
          v.value = withSequence(
            withTiming(0.55, { duration: 1100, easing: ease }),
            withDelay(900, withTiming(0.7, { duration: 400, easing: ease })),
            withTiming(0, { duration: 160 }),
            withTiming(1, { duration: 110 }),
            withTiming(0, { duration: 150 }),
          );
        };
        sink(blinkL);
        sink(blinkR);
        tilt.value = withSequence(withTiming(2, { duration: 1500, easing: ease }), withDelay(900, withSpring(0, { damping: 8, stiffness: 170 })));
        gy.value = withTiming(1.2, { duration: 900 });
        browL.value = withDelay(2400, withSequence(withTiming(1, { duration: 140 }), withDelay(450, withTiming(0, { duration: 300 }))));
        browR.value = withDelay(2400, withSequence(withTiming(1, { duration: 140 }), withDelay(450, withTiming(0, { duration: 300 }))));
        break;
      }
      case 'think':
        gx.value = withTiming(-2.2, { duration: 260 });
        gy.value = withTiming(-1.8, { duration: 260 });
        hold(browR, 1, 260, 1500, 360);
        hold(press, 1, 260, 1500, 360);
        hold(tilt, -1.6, 360, 1300, 420);
        break;
      case 'nod':
        tilt.value = withSequence(withTiming(1.4, { duration: 200, easing: ease }), withTiming(-0.8, { duration: 220, easing: ease }), withTiming(0.6, { duration: 200, easing: ease }), withTiming(0, { duration: 240, easing: ease }));
        hold(smile, 0.7, 200, 500, 300);
        break;
      case 'sleepy':
        blinkBoth(false, true);
        break;
      case 'yawn': {
        lastYawn.current = Date.now();
        hold(yawn, 1, 700, 900, 520);
        hold(browL, 0.9, 600, 1000, 520);
        hold(browR, 0.9, 600, 1000, 520);
        hold(tilt, -2.4, 700, 900, 520);
        const squint = (v: SharedValue<number>) => { v.value = withSequence(withTiming(0.75, { duration: 600, easing: ease }), withDelay(1000, withTiming(0, { duration: 520, easing: ease }))); };
        squint(blinkL);
        squint(blinkR);
        break;
      }
    }
  }, [smile, browL, browR, wide, gx, gy, press, tilt, blinkBoth, yawn, blinkL, blinkR]);

  useEffect(() => {
    if (!alive) return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        if (!talking) {
          let e = POOL[Math.floor(Math.random() * POOL.length)];
          if (e === 'yawn' && Date.now() - lastYawn.current < 40_000) e = 'smile';
          play(e);
        }
        next();
      }, 6000 + Math.random() * 6000);
    };
    next();
    return () => clearTimeout(t);
  }, [alive, talking, play]);

  // A reaction: brows up, a double blink, eyes to you, a hop, hoops jiggle, a smile.
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
    jig.value = withSequence(withTiming(1, { duration: 90 }), withTiming(-1, { duration: 140 }), withTiming(0.6, { duration: 120 }), withTiming(0, { duration: 160 }));
    smile.value = withSequence(withTiming(1, { duration: 160 }), withDelay(800, withTiming(0, { duration: 260 })));
  }, [blinkBoth, gx, gy, browL, browR, hop, jig, smile]);
  useEffect(() => {
    listeners.add(react);
    return () => { listeners.delete(react); };
  }, [react]);

  // Pivots in points (static styles); only the transforms animate.
  const at = (o: { x: number; y: number }) => ({ transformOrigin: [o.x * k, o.y * k, 0] as [number, number, number] });
  const eyeL = useAnimatedStyle(() => ({ transform: [{ translateX: gx.value * k }, { translateY: gy.value * k }, { scaleY: Math.max(0.06, 1 - 0.92 * blinkL.value + 0.12 * wide.value) }] }));
  const eyeR = useAnimatedStyle(() => ({ transform: [{ translateX: gx.value * k }, { translateY: gy.value * k }, { scaleY: Math.max(0.06, 1 - 0.92 * blinkR.value + 0.12 * wide.value) }] }));
  const lidL = useAnimatedStyle(() => ({ transform: [{ translateY: (4.95 * blinkL.value - 1.2 * wide.value) * k }, { scaleY: 1 - 0.45 * blinkL.value }] }));
  const lidR = useAnimatedStyle(() => ({ transform: [{ translateY: (4.95 * blinkR.value - 1.2 * wide.value) * k }, { scaleY: 1 - 0.45 * blinkR.value }] }));
  const brL = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * k * browL.value }, { rotate: `${-4 * browL.value}deg` }] }));
  const brR = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * k * browR.value }, { rotate: `${4 * browR.value}deg` }] }));
  const lips = useAnimatedStyle(() => ({
    opacity: (1 - smile.value) * (1 - yawn.value),
    transform: [{ scaleX: 1 - 0.12 * press.value }, { scaleY: 1 + 0.32 * talk.value - 0.35 * press.value }],
  }));
  const smileLips = useAnimatedStyle(() => ({ opacity: smile.value * (1 - yawn.value), transform: [{ scaleY: 1 + 0.25 * talk.value }] }));
  const mouth = useAnimatedStyle(() => ({ opacity: yawn.value > 0.02 ? 1 : 0, transform: [{ scaleX: 0.5 + 0.5 * yawn.value }, { scaleY: Math.max(0.05, yawn.value) }] }));
  const hoopLs = useAnimatedStyle(() => ({ transform: [{ rotate: `${7 * hopL.value + 16 * jig.value}deg` }] }));
  const hoopRs = useAnimatedStyle(() => ({ transform: [{ rotate: `${7 * hopR.value - 16 * jig.value}deg` }] }));
  const whole = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }, { scale: hop.value }, { rotate: `${tilt.value}deg` }, { scaleY: 1 + 0.025 * yawn.value }] }));

  const layer = (children: React.ReactNode, st: object, origin: object) => (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, origin, st]}>
      <Svg width={size} height={size} viewBox="0 0 400 400"><G transform={FRAME}>{children}</G></Svg>
    </Animated.View>
  );
  const eye = (cx: number) => (<>
    <Ellipse cx={cx} cy={201} rx={6.4} ry={7.6} fill="#1A1F38" />
    <Circle cx={cx + 2.2} cy={198.2} r={2.1} fill="#FFFFFF" />
    <Circle cx={cx - 2} cy={204.2} r={0.9} fill="#FFFFFF" fillOpacity={0.7} />
  </>);
  const brow = (d: string) => <Path d={d} fill="none" stroke="#2B1F1C" strokeWidth={5} strokeLinecap="round" />;
  const hoop = (cx: number) => (<>
    <Circle cx={cx} cy={236} r={10} fill="none" stroke="#C9A227" strokeWidth={4} />
    <Path d={`M${cx - 7} 231 a10 10 0 0 1 5 -4.5`} fill="none" stroke="#FFF3C4" strokeWidth={1.6} strokeLinecap="round" />
  </>);

  return (
    <Pressable onPress={react} accessibilityRole="image" accessibilityLabel={rose.name} style={style}>
      <Animated.View style={[{ width: size, height: size, transformOrigin: [CHIN.x * k, CHIN.y * k, 0] }, whole]}>
        <Image source={BASE} style={StyleSheet.absoluteFill} contentFit="contain" />
        {layer(brow('M163 182 Q180 172 196 180'), brL, at(BROW_L))}
        {layer(brow('M204 180 Q220 172 237 182'), brR, at(BROW_R))}
        {layer(eye(180), eyeL, at(EYE_L))}
        {layer(eye(220), eyeR, at(EYE_R))}
        {layer(<G fill="none" stroke="#1A1F38" strokeLinecap="round">
          <Path d="M169 197.5 Q180 189 191 197.5" strokeWidth={2.8} />
          <Path d="M169 197.5 q-3 -1 -5 -3.4" strokeWidth={2.4} />
        </G>, lidL, at(LID_L))}
        {layer(<G fill="none" stroke="#1A1F38" strokeLinecap="round">
          <Path d="M209 197.5 Q220 189 231 197.5" strokeWidth={2.8} />
          <Path d="M231 197.5 q3 -1 5 -3.4" strokeWidth={2.4} />
        </G>, lidR, at(LID_R))}
        {layer(<>
          <Path d="M186 240 Q193 236 200 239 Q207 236 214 240 Q200 251 186 240 Z" fill="#B8323F" />
          <Ellipse cx={205} cy={244.5} rx={4} ry={1.3} fill="#FFFFFF" fillOpacity={0.45} />
        </>, lips, at(LIPS))}
        {/* Her smile: the corners up, the lower lip fuller. */}
        {layer(<>
          <Path d="M183 237.5 Q192 236.5 200 239.5 Q208 236.5 217 237.5 Q200 255 183 237.5 Z" fill="#B8323F" />
          <Path d="M187 240 Q200 246 213 240" fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" />
        </>, smileLips, at(LIPS))}
        {/* The yawn: an open mouth, the tongue showing. */}
        {layer(<>
          <Ellipse cx={200} cy={246} rx={8} ry={10.5} fill="#5B1E2A" stroke="#B8323F" strokeWidth={3} />
          <Ellipse cx={200} cy={252} rx={4.6} ry={3} fill="#D9707A" />
        </>, mouth, at(MOUTH))}
        {layer(hoop(146), hoopLs, at(HOOP_L))}
        {layer(hoop(254), hoopRs, at(HOOP_R))}
        <RoseProps activity={activity} size={size} alive={alive} />
      </Animated.View>
    </Pressable>
  );
});
