import { useEffect, useRef } from 'react';
import { Animated, View, type DimensionValue, type ViewStyle, type StyleProp } from 'react-native';
import { colors, radius, spacing } from '@/theme/index';

/**
 * Loading placeholders — the redesign replaces bare spinners with skeletons that
 * echo the shape of the content about to arrive, so a load reads as "almost
 * there" instead of "blank". Uses RN's core Animated (no worklet/babel surface)
 * because a placeholder must render even when everything else is still booting.
 */

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  /** Corner radius; defaults to the small token. Pass `radius.full` for a dot. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, radius: r = radius.sm, style }: SkeletonProps) {
  // A single shared pulse — 0.4 → 1 → 0.4 opacity, native-driven.
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: r, backgroundColor: colors.borderLight, opacity: pulse }, style]}
    />
  );
}

/** A stack of text lines; the last line is shortened so it reads as a paragraph. */
export function SkeletonText({ lines = 3, lineHeight = 14, gap = spacing.sm }: { lines?: number; lineHeight?: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={lineHeight} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </View>
  );
}

/**
 * A card-shaped placeholder for list screens: an avatar block, two title lines,
 * and a trailing chip. Render a few of these instead of a centred spinner.
 */
export function SkeletonCard() {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.xl,
        padding: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <Skeleton width={44} height={44} radius={radius.md} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton height={15} width="70%" />
        <Skeleton height={12} width="45%" />
      </View>
      <Skeleton width={56} height={22} radius={radius.full} />
    </View>
  );
}

/** Convenience: `count` card skeletons with the standard gap. */
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}
