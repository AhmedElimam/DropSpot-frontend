import { memo, useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { useAmbientMotion } from '@/hooks/useAmbientMotion';
import { fonts } from '@/theme/typography';
import { useRose } from '@/hooks/useRose';
import { useRosePictures } from './RoseCostume';
import { Surface } from '@/ui/surfaces';

/**
 * مدام روز asleep at her desk (founder 2026-10-09: «on the home page, if there's nothing on
 * Madam Rose's desk, make the animation of sleep»). Her eyes closed, her brows soft, breathing
 * evenly with her head a touch to the side, and «Z z z» drifting up beside her now and then.
 *
 * Drawn as ONE still picture — her painted portrait with the eyes closed (madam-rose-sleep.webp,
 * since 2026-10-25 the painted Rose; the lids are painted on the same picture), her head
 * already resting to one side. The only motion is a puff of three small
 * «Z» every six seconds (opacity + transform on the UI thread, ~2 s), and nothing in between:
 * the full rig is what heated MediaTek phones (2026-10-08), and the founder wants no heat, lag
 * or glitch from her. Off-screen, backgrounded or under reduced motion, nothing runs. In
 * «وضع المراجعة» she dozes in her season picture (RoseCostume: the cardigan and the pencil are
 * in the artwork itself, founder 2026-10-17).
 */
const CHIN = { x: 200, y: 392 };
const PUFF_EVERY_MS = 6000;

/**
 * One «Z». It rises and fades once per puff, then rests at zero opacity — nothing animates
 * between puffs.
 */
function Zee({ puff, delay, size, x }: { puff: number; delay: number; size: number; x: number }) {
  const p = useSharedValue(1);
  useEffect(() => {
    if (puff === 0) { cancelAnimation(p); p.value = 1; return; }
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }));
  }, [puff, delay, p]);
  const st = useAnimatedStyle(() => ({
    opacity: p.value >= 1 ? 0 : p.value < 0.15 ? p.value / 0.15 : 1 - (p.value - 0.15) / 0.85,
    transform: [{ translateY: -size * 1.6 * p.value }, { translateX: size * 0.5 * p.value }, { scale: 0.7 + 0.5 * p.value }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, end: x }, st]}>
      <Text style={{ fontFamily: fonts.bold, fontSize: size, color: '#34419B', writingDirection: 'ltr' }}>Z</Text>
    </Animated.View>
  );
}

/**
 * Her sleeping picture — drawn once and never again: memoised, so a puff of «Z» (a state
 * change in the parent) does not redraw the image.
 */
const StillFace = memo(function StillFace({ size }: { size: number }) {
  const k = size / 400;
  const pictures = useRosePictures();
  return (
    // Her head already resting to one side — still. Scaling the picture every frame was the costly part.
    <View style={{ width: size, height: size, transformOrigin: [CHIN.x * k, CHIN.y * k, 0], transform: [{ rotate: '-4deg' }] }}>
      <Image source={pictures.sleep} style={StyleSheet.absoluteFill} contentFit="contain" />
    </View>
  );
});

export function RoseSleeping({ size }: { size: number }) {
  const rose = useRose();
  // In front of you, app active, motion allowed (Android keeps JS timers running in the background).
  const run = useAmbientMotion();

  // A puff of «Z z z» every few seconds — a burst, not a loop (founder 2026-10-09: «no heat
  // or lagging or glitching»). Between puffs nothing on the home animates; off-screen, in the
  // background or under reduced motion, nothing runs at all.
  const [puff, setPuff] = useState(0);
  useEffect(() => {
    if (!run) { setPuff(0); return; }
    setPuff((n) => n + 1);
    const id = setInterval(() => setPuff((n) => n + 1), PUFF_EVERY_MS);
    return () => clearInterval(id);
  }, [run]);

  const z = Math.max(9, size * 0.17);
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${rose.name} — نايمة`}>
      <StillFace size={size} />
      {/* «Z z z» from just above her head, on the side her head leans to. */}
      <Surface id="teacher.rose.sleeping.zees">
      <View pointerEvents="none" style={{ position: 'absolute', top: size * 0.06, end: -size * 0.1, width: size * 0.5, height: size * 0.4 }}>
        <Zee puff={puff} delay={0} size={z * 0.75} x={size * 0.24} />
        <Zee puff={puff} delay={450} size={z} x={size * 0.12} />
        <Zee puff={puff} delay={900} size={z * 1.2} x={0} />
      </View>
      </Surface>
    </View>
  );
}
