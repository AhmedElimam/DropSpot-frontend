import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows, spacing } from '@/theme/index';
import { useRose } from '@/hooks/useRose';

/**
 * مدام روز's marks in the app (founder 2026-10-07: «put her stamps on operations as we're
 * showing on the landing page»). Two inks, one rule: a stamp means the operation is in HER
 * BOOK — the count that balanced, the handover the teacher confirmed, the week that closed,
 * the complaint that was decided (whichever way). Never a grade, never approval of a person.
 *
 *   navy  — the cash book: counts, handovers, closed weeks, accepted expenses.
 *   red   — the complaints book: a decision recorded.
 *
 * The thump is the landing page's: she lands from above, tilted and large, presses, settles.
 * A teacher who switched her name off (useRose().named) sees no stamp anywhere; the words
 * on the screen already carry the fact without her.
 */
export type StampInk = 'navy' | 'red';

const STAMP: Record<StampInk, number> = {
  navy: require('../../../assets/images/rose/rose-stamp-navy.webp'),
  red: require('../../../assets/images/rose/rose-stamp-red.webp'),
};
export const ROSE_PORTRAIT = require('../../../assets/images/rose/madam-rose.webp');
/** 600 px — for the large frame on her desk (the 300 px one blurs above ~100 pt on a 3× screen). */
export const ROSE_PORTRAIT_LARGE = require('../../../assets/images/rose/madam-rose-600.webp');
/** Her crest's shield — her LOGO at small sizes (≤ 56 pt): her notifications, her notes. */
export const ROSE_SHIELD = require('../../../assets/images/rose/rose-shield-128.webp');

const LAND = { damping: 11, stiffness: 190, mass: 0.8 };
const NOD = { damping: 9, stiffness: 150, mass: 0.9 };

export function RoseStamp({ ink = 'navy', size = 48, animate = false, tilt = -8, style }: {
  ink?: StampInk;
  size?: number;
  /** Land with the thump on mount (an operation that just happened), else sit still (one from before). */
  animate?: boolean;
  tilt?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const rose = useRose();
  const scale = useSharedValue(animate ? 1.9 : 1);
  const opacity = useSharedValue(animate ? 0 : 0.92);
  useEffect(() => {
    if (!animate) return;
    scale.value = 1.9;
    opacity.value = 0;
    opacity.value = withTiming(0.92, { duration: 140 });
    scale.value = withSequence(withTiming(0.94, { duration: 230, easing: Easing.out(Easing.cubic) }), withSpring(1, LAND));
  }, [animate, scale, opacity]);
  const st = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ rotate: `${tilt}deg` }, { scale: scale.value }] }));
  if (!rose.named) return null;
  return (
    <Animated.View style={[{ width: size, height: size }, st, style]} pointerEvents="none" accessibilityRole="image" accessibilityLabel={`ختم ${rose.name}`}>
      <Image source={STAMP[ink]} style={StyleSheet.absoluteFill} contentFit="contain" />
    </Animated.View>
  );
}

/** Her portrait, with the small nod she gives when a screen opens (the tour's own motion). */
export function RosePortrait({ size = 64, nod = true, large = false, style }: { size?: number; nod?: boolean; large?: boolean; style?: StyleProp<ViewStyle> }) {
  const rose = useRose();
  const s = useSharedValue(nod ? 0.84 : 1);
  useEffect(() => {
    if (nod) s.value = withSpring(1, NOD);
  }, [nod, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }, { rotate: `${(1 - s.value) * -36}deg` }] }));
  return (
    <Animated.View style={[{ width: size, height: size }, st, style]}>
      <Image source={large || size > 100 ? ROSE_PORTRAIT_LARGE : ROSE_PORTRAIT} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={rose.name} />
    </Animated.View>
  );
}

/** Her logo: the crest's shield, still. */
export function RoseShield({ size = 44, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const rose = useRose();
  return <Image source={ROSE_SHIELD} style={[{ width: size, height: size }, style as object]} contentFit="contain" accessibilityLabel={rose.name} />;
}

/**
 * The moment an operation lands in her book: a full-screen, touch-through flash of the stamp
 * thumping onto a sheet with one line under it, gone after ~1.5 s. Use `useStampBurst()`.
 */
function StampBurst({ ink, text, onDone }: { ink: StampInk; text: string; onDone: () => void }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withSequence(
      withTiming(1, { duration: 120 }),
      withDelay(1250, withTiming(0, { duration: 280 }, (finished) => { if (finished) runOnJS(onDone)(); })),
    );
  }, [o, onDone]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', zIndex: 50 }, st]}>
      <View style={{ alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.xl, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, maxWidth: '82%', ...shadows.md }}>
        <RoseStamp ink={ink} size={132} animate />
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 23 }}>{text}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * `burst(ink, text)` shows the flash and returns true; it returns false — showing nothing —
 * when this teacher has switched her name off, so the caller can fall back to a plain alert.
 * Render `burstNode` once, last in the screen's root view.
 */
export function useStampBurst(): { burst: (ink: StampInk, text: string) => boolean; burstNode: ReactNode } {
  const rose = useRose();
  const [b, setB] = useState<{ ink: StampInk; text: string; key: number } | null>(null);
  const burst = useCallback((ink: StampInk, text: string) => {
    if (!rose.named) return false;
    setB({ ink, text, key: Date.now() });
    return true;
  }, [rose.named]);
  const done = useCallback(() => setB(null), []);
  const burstNode = b ? <StampBurst key={b.key} ink={b.ink} text={b.text} onDone={done} /> : null;
  return { burst, burstNode };
}
