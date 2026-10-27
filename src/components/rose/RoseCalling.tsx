import { useEffect } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/index';
import { RosePortrait } from './RoseStamp';
import { RoseLive } from './RoseLive';
import { useAmbientMotion } from '@/hooks/useAmbientMotion';
import { Surface } from '@/ui/surfaces';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const HAND = require('../../../assets/images/rose/rose-hand.webp');

/**
 * مدام روز on the home shortcut, CALLING you when something is waiting on her desk (founder
 * 2026-10-08: «an animation of waving … I want Madam Rose to wave herself»). With nothing
 * waiting she sleeps (founder 2026-10-25): RoseLive asleep.
 *
 * The hand is HER OWN painted hand (founder 2026-10-27: «her hand on waving doesn't look
 * natural at all, neither how it looks nor the motion»): cut from the painted sheet's raised
 * palm — same brush, same ink line, white cuff — mirrored so the thumb faces her, with a soft
 * contact shadow (assets/images/rose/rose-hand.webp). The flat drawn arm is gone.
 *
 * The motion is a person's wave, not a metronome: the hand comes up from below her frame
 * leaning out and rights itself as it arrives (spring, a touch of overshoot), waves from the
 * WRIST with sine easing and an amplitude that dies away (1, −1, .8, −.6, .3), the forearm
 * sways a beat behind the hand, and it drops back with gravity. Clipped to the medallion so
 * the cuff leaves through the frame's edge. A burst, not a loop: none while the screen is not
 * in front of you or the phone asks for reduced motion.
 */
const EVERY_MS = 6000;
const SETTLED_EVERY_MS = 20000;
/** Her medallion inside the gold rim, in the portrait's 400-unit square. */
const CLIP = { x: 200, y: 211, r: 171 };
/** The hand picture (207×298) drawn 140 units tall, its wrist pivot on the disc's lower-right edge. */
const HAND_H = 140;
const HAND_W = (HAND_H * 207) / 298;
const PIVOT = { x: 0.64, y: 0.93 };
const WRIST = { x: 306, y: 352 };
/** Resting lean (degrees, top outward), the swing either side of it, and the lean while rising. */
const REST = 8;
const SWING = 14;
const RISE_LEAN = 16;

export function RoseCalling({ size, calling }: { size: number; calling: boolean }) {
  // Only while she can be seen, the app is in front and motion is allowed (founder 2026-10-09).
  const live = useAmbientMotion(!calling);
  const k = size / 400;

  const lift = useSharedValue(0); // 0 = down below her frame … 1 = raised
  const wave = useSharedValue(0); // −1 … 1 around the rest lean (the wrist)
  const sway = useSharedValue(0); // the forearm, a beat behind the hand
  const ring = useSharedValue(0);

  useEffect(() => {
    if (!live) {
      cancelAnimation(lift); cancelAnimation(wave); cancelAnimation(sway); cancelAnimation(ring);
      lift.value = 0; wave.value = 0; sway.value = 0; ring.value = 0;
      return;
    }
    const sine = Easing.inOut(Easing.sin);
    const swings = (amp: number[]) => withSequence(...amp.map((a, i) => withTiming(a, { duration: i === 0 ? 210 : 250, easing: sine })));
    const burst = () => {
      // Up (a little overshoot, then settle), hold through the wave, then down with gravity.
      lift.value = withSequence(
        withSpring(1, { damping: 11, stiffness: 150, mass: 0.9 }),
        withDelay(1150, withTiming(0, { duration: 420, easing: Easing.in(Easing.cubic) })),
      );
      wave.value = withDelay(300, swings([1, -1, 0.8, -0.6, 0.3, 0]));
      sway.value = withDelay(370, swings([1, -1, 0.8, -0.6, 0.3, 0]));
      ring.value = 0;
      ring.value = withDelay(200, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));
    };
    // Three waves when you arrive, then one every 20 s: the call is made without her moving a
    // third of the time the home is open (founder 2026-10-09: «light on all devices»).
    let n = 0;
    let t: ReturnType<typeof setTimeout>;
    const next = () => { t = setTimeout(() => { burst(); n += 1; next(); }, n < 3 ? EVERY_MS : SETTLED_EVERY_MS); };
    t = setTimeout(() => { burst(); n = 1; next(); }, 700);
    return () => clearTimeout(t);
  }, [live, lift, wave, sway, ring]);

  // Pivots at the wrist. Rising, it leans out and rights itself as it arrives; the forearm's
  // sway carries the whole hand a few units side to side behind the wrist's swing.
  const handSt = useAnimatedStyle(() => {
    const l = Math.min(1, Math.max(0, lift.value));
    return {
      opacity: lift.value > 0.01 ? 1 : 0,
      transform: [
        { translateX: 5 * k * sway.value },
        { translateY: (1 - lift.value) * 175 * k },
        { rotate: `${REST + RISE_LEAN * (1 - l) + SWING * wave.value}deg` },
      ],
    };
  });
  const ringSt = useAnimatedStyle(() => ({
    opacity: ring.value > 0 && ring.value < 1 ? 0.55 * (1 - ring.value) : 0,
    transform: [{ scale: 0.9 + 0.36 * ring.value }],
  }));

  const clipLeft = (CLIP.x - CLIP.r) * k;
  const clipTop = (CLIP.y - CLIP.r) * k;
  return (
    <View style={{ width: size, height: size }}>
      {calling ? (
        <Surface id="teacher.rose.calling.ring">
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: clipLeft, top: clipTop, width: 2 * CLIP.r * k, height: 2 * CLIP.r * k, borderRadius: CLIP.r * k, borderWidth: 3, borderColor: colors.accent }, ringSt]} />
        </Surface>
      ) : null}
      {/* Something waiting: awake, and calling. An empty desk: she sleeps (the shortcut takes the tap). */}
      {calling ? <RosePortrait size={size} nod={false} /> : <Surface id="teacher.rose.sleeping" fallback={<RosePortrait size={size} nod={false} />}><RoseLive size={size} asleep interactive={false} /></Surface>}
      {calling ? (
        <Surface id="teacher.rose.calling.wave">
        {/* direction ltr: the app is forced RTL, which would mirror `left` and put her hand on
            the wrong side, thumb outward. Inside her frame, left means the painting's left. */}
        <View pointerEvents="none" style={{ position: 'absolute', left: clipLeft, top: clipTop, width: 2 * CLIP.r * k, height: 2 * CLIP.r * k, borderRadius: CLIP.r * k, overflow: 'hidden', direction: 'ltr' }}>
          <Animated.View
            style={[{
              position: 'absolute',
              left: (WRIST.x - PIVOT.x * HAND_W) * k - clipLeft,
              top: (WRIST.y - PIVOT.y * HAND_H) * k - clipTop,
              width: HAND_W * k, height: HAND_H * k,
              transformOrigin: [PIVOT.x * HAND_W * k, PIVOT.y * HAND_H * k, 0],
            }, handSt]}
          >
            <Image source={HAND} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          </Animated.View>
        </View>
        </Surface>
      ) : null}
    </View>
  );
}
