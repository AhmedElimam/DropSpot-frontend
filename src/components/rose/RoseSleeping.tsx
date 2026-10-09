import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, G, Path } from 'react-native-svg';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { fonts } from '@/theme/typography';
import { useRose } from '@/hooks/useRose';

/**
 * مدام روز asleep at her desk (founder 2026-10-09: «on the home page, if there's nothing on
 * Madam Rose's desk, make the animation of sleep»). Her eyes closed, her brows soft, breathing
 * slowly with her head a touch to the side, and «Z z z» drifting up beside her.
 *
 * Drawn as ONE still picture — her live base (madam-rose-live-base.webp, the portrait minus
 * eyes, brows, lips and earrings) with the sleeping face over it in the same 400-unit frame
 * as RoseLive — so the only motion is two cheap UI-thread loops (the breath and the Z's). That
 * matters on the home: the full rig is what heated MediaTek phones (2026-10-08). Both loops
 * stop when the home is not in front of you or the phone asks for less motion.
 */
const BASE = require('../../../assets/images/rose/madam-rose-live-base.webp');
const FRAME = 'translate(200 212) scale(0.9) translate(-200 -200)';
const CHIN = { x: 200, y: 392 };
const INK = '#1A1F38';

function Face() {
  return (
    <G transform={FRAME}>
      {/* Brows at rest — a little lower and flatter than awake. */}
      <Path d="M164 185 Q180 178 196 184" fill="none" stroke="#2B1F1C" strokeWidth={5} strokeLinecap="round" />
      <Path d="M204 184 Q220 178 236 185" fill="none" stroke="#2B1F1C" strokeWidth={5} strokeLinecap="round" />
      {/* Eyes closed: a soft downward arc with her lashes. */}
      <G fill="none" stroke={INK} strokeLinecap="round">
        <Path d="M169 200 Q180 208 191 200" strokeWidth={2.8} />
        <Path d="M174 205 l-1.5 3.2 M180 206.6 l0 3.4 M186 205 l1.5 3.2" strokeWidth={1.6} />
        <Path d="M209 200 Q220 208 231 200" strokeWidth={2.8} />
        <Path d="M214 205 l-1.5 3.2 M220 206.6 l0 3.4 M226 205 l1.5 3.2" strokeWidth={1.6} />
      </G>
      {/* Lips at rest, a breath apart. */}
      <Path d="M188 240 Q194 237 200 239.5 Q206 237 212 240 Q200 248 188 240 Z" fill="#B8323F" />
      <Path d="M196 243.5 Q200 245 204 243.5" fill="none" stroke="#5B1E2A" strokeWidth={1.4} strokeLinecap="round" />
      {/* Her gold hoops. */}
      {[146, 254].map((cx) => (
        <G key={cx}>
          <Circle cx={cx} cy={236} r={10} fill="none" stroke="#C9A227" strokeWidth={4} />
          <Path d={`M${cx - 7} 231 a10 10 0 0 1 5 -4.5`} fill="none" stroke="#FFF3C4" strokeWidth={1.6} strokeLinecap="round" />
        </G>
      ))}
    </G>
  );
}

/** One «Z», rising and fading on its own beat. */
function Zee({ delay, size, x, run }: { delay: number; size: number; x: number; run: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!run) { cancelAnimation(p); p.value = 0; return; }
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false));
  }, [run, delay, p]);
  const st = useAnimatedStyle(() => ({
    opacity: p.value < 0.15 ? p.value / 0.15 : 1 - (p.value - 0.15) / 0.85,
    transform: [{ translateY: -size * 1.6 * p.value }, { translateX: size * 0.5 * p.value }, { scale: 0.7 + 0.5 * p.value }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, end: x }, st]}>
      <Text style={{ fontFamily: fonts.bold, fontSize: size, color: '#34419B', writingDirection: 'ltr' }}>Z</Text>
    </Animated.View>
  );
}

export function RoseSleeping({ size }: { size: number }) {
  const rose = useRose();
  const focused = useIsFocused();
  const still = useReducedMotion();
  const run = focused && !still;
  const k = size / 400;

  // The breath: a slow rise and fall, her head resting a little to one side.
  const breath = useSharedValue(0);
  useEffect(() => {
    if (!run) { cancelAnimation(breath); breath.value = 0; return; }
    breath.value = withRepeat(withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [run, breath]);
  const body = useAnimatedStyle(() => ({
    transform: [{ rotate: '-4deg' }, { scale: 1 + 0.025 * breath.value }, { translateY: -1.2 * breath.value }],
  }));

  const z = Math.max(9, size * 0.17);
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${rose.name} — نايمة`}>
      <Animated.View style={[{ width: size, height: size, transformOrigin: [CHIN.x * k, CHIN.y * k, 0] }, body]}>
        <Image source={BASE} style={StyleSheet.absoluteFill} contentFit="contain" />
        <Svg width={size} height={size} viewBox="0 0 400 400" style={StyleSheet.absoluteFill}>
          <Face />
        </Svg>
      </Animated.View>
      {/* «Z z z» from just above her head, on the side her head leans to. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: size * 0.06, end: -size * 0.1, width: size * 0.5, height: size * 0.4 }}>
        <Zee run={run} delay={0} size={z * 0.75} x={size * 0.24} />
        <Zee run={run} delay={800} size={z} x={size * 0.12} />
        <Zee run={run} delay={1600} size={z * 1.2} x={0} />
      </View>
    </View>
  );
}
