import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Rect, Path } from 'react-native-svg';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { colors } from '@/theme/index';
import { RosePortrait } from './RoseStamp';

/**
 * مدام روز on the home shortcut, CALLING you when something is waiting on her desk (founder
 * 2026-10-08: «an animation of waving … I want Madam Rose to wave herself»). Every few
 * seconds her own hand rises out of her frame — her blazer sleeve, gold piping, the cream
 * blouse cuff, her hand — waves three times from the elbow, and goes down again, while a ring
 * pulses out around her. With nothing waiting she is the still portrait.
 *
 * The arm is drawn in her portrait's 400-unit square and clipped to the medallion (centre
 * 200,211, inside the gold rim), so it reads as coming from her, not pasted on top. A burst,
 * not a loop: about two seconds of motion every six, none while the screen is not in front of
 * you or the phone asks for reduced motion.
 */
const EVERY_MS = 6000;
const ELBOW = { x: 318, y: 392 };
const TILT = -9;
const CLIP = { x: 200, y: 211, r: 171 };
const SKIN = '#D49A72';
const SKIN_SHADE = '#C08560';
const BLAZER = '#34419B';
const BLAZER_SHADE = '#283482';
const GOLD = '#C9A227';
const CUFF = '#F4EFE6';

/** Her raised forearm and hand, upright, the elbow at (0,0). */
function Arm() {
  return (
    <>
      <Rect x={-23} y={-98} width={46} height={120} rx={14} fill={BLAZER} />
      <Rect x={-23} y={-98} width={14} height={120} rx={7} fill={BLAZER_SHADE} opacity={0.7} />
      <Rect x={-23} y={-100} width={46} height={5} rx={2.5} fill={GOLD} />
      <Rect x={-19} y={-111} width={38} height={13} rx={4} fill={CUFF} />
      <Rect x={-19} y={-100} width={38} height={2} fill="#E4DDCE" />
      <G fill={SKIN}>
        <Rect x={-17} y={-152} width={34} height={46} rx={12} />
        <Rect x={-17} y={-178} width={8} height={40} rx={4} />
        <Rect x={-8} y={-186} width={8} height={48} rx={4} />
        <Rect x={1} y={-183} width={8} height={45} rx={4} />
        <Rect x={10} y={-172} width={7.5} height={36} rx={3.75} />
        <Rect x={-23} y={-136} width={9} height={28} rx={4.5} transform="rotate(-38 -18 -122)" />
      </G>
      <G stroke={SKIN_SHADE} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.8}>
        <Path d="M-8.5 -146 V-140 M0.5 -146 V-139 M9.5 -146 V-141" />
        <Path d="M-9 -122 Q0 -116 9 -124" />
      </G>
      <Rect x={10} y={-152} width={7} height={44} rx={3.5} fill={SKIN_SHADE} opacity={0.35} />
    </>
  );
}

export function RoseCalling({ size, calling }: { size: number; calling: boolean }) {
  const focused = useIsFocused();
  const still = useReducedMotion();
  const live = calling && focused && !still;
  const k = size / 400;

  const lift = useSharedValue(0); // 0 = down inside her frame … 1 = raised
  const wave = useSharedValue(0); // −1 … 1 around the rest angle
  const ring = useSharedValue(0);

  useEffect(() => {
    if (!live) {
      cancelAnimation(lift); cancelAnimation(wave); cancelAnimation(ring);
      lift.value = 0; wave.value = 0; ring.value = 0;
      return;
    }
    const ease = Easing.inOut(Easing.quad);
    const burst = () => {
      lift.value = withSequence(
        withSpring(1, { damping: 13, stiffness: 160 }),
        withDelay(1350, withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) })),
      );
      wave.value = withDelay(260, withSequence(
        withTiming(1, { duration: 200, easing: ease }), withTiming(-1, { duration: 260, easing: ease }),
        withTiming(1, { duration: 260, easing: ease }), withTiming(-1, { duration: 260, easing: ease }),
        withTiming(0.5, { duration: 220, easing: ease }), withTiming(0, { duration: 200, easing: ease }),
      ));
      ring.value = 0;
      ring.value = withDelay(200, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));
    };
    const first = setTimeout(burst, 700);
    const every = setInterval(burst, EVERY_MS);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [live, lift, wave, ring]);

  // The arm's layer is the full 400-square, offset inside the medallion clip; it pivots at the elbow.
  const armSt = useAnimatedStyle(() => ({
    opacity: lift.value > 0.01 ? 1 : 0,
    transform: [{ translateY: (1 - lift.value) * 175 * k }, { rotate: `${11 * wave.value}deg` }],
  }));
  const ringSt = useAnimatedStyle(() => ({
    opacity: ring.value > 0 && ring.value < 1 ? 0.55 * (1 - ring.value) : 0,
    transform: [{ scale: 0.9 + 0.36 * ring.value }],
  }));

  const clipLeft = (CLIP.x - CLIP.r) * k;
  const clipTop = (CLIP.y - CLIP.r) * k;
  return (
    <View style={{ width: size, height: size }}>
      {calling ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: clipLeft, top: clipTop, width: 2 * CLIP.r * k, height: 2 * CLIP.r * k, borderRadius: CLIP.r * k, borderWidth: 3, borderColor: colors.accent }, ringSt]} />
      ) : null}
      <RosePortrait size={size} nod={false} />
      {calling ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: clipLeft, top: clipTop, width: 2 * CLIP.r * k, height: 2 * CLIP.r * k, borderRadius: CLIP.r * k, overflow: 'hidden' }}>
          <Animated.View style={[{ position: 'absolute', left: -clipLeft, top: -clipTop, width: size, height: size, transformOrigin: [ELBOW.x * k, ELBOW.y * k, 0] }, armSt]}>
            <Svg width={size} height={size} viewBox="0 0 400 400" style={StyleSheet.absoluteFill}>
              <G transform={`translate(${ELBOW.x} ${ELBOW.y}) rotate(${TILT})`}>
                <Arm />
              </G>
            </Svg>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}
