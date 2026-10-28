import { useEffect } from 'react';
import { TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, radius, shadows } from '@/theme/index';
import { ReactionGlyph, type ReactionKind } from './ReactionGlyph';

/**
 * The reaction bar a long press opens: our glyphs on a floating pill that pops in once (one
 * spring on transform, then still — no endless motion). The chosen one sits on a tinted disc.
 */
export function ReactionPicker({ kinds, mine, onPick, label, style, size = 34 }: {
  kinds: readonly ReactionKind[];
  mine: ReactionKind | null;
  onPick: (k: ReactionKind) => void;
  label: (k: ReactionKind) => string;
  style?: StyleProp<ViewStyle>;
  size?: number;
}) {
  const s = useSharedValue(0.7);
  useEffect(() => { s.value = withSpring(1, { damping: 13, stiffness: 260 }); }, [s]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: Math.min(1, (s.value - 0.7) / 0.3) }));
  const cell = size + 10;
  return (
    <Animated.View style={[{ flexDirection: 'row', gap: 2, paddingHorizontal: 6, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadows.md }, pop, style]}>
      {kinds.map((k) => (
        <TouchableOpacity key={k} onPress={() => onPick(k)} hitSlop={4} accessibilityRole="button" accessibilityLabel={label(k)} accessibilityState={{ selected: mine === k }}
          style={{ width: cell, height: cell, borderRadius: cell / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: mine === k ? colors.brandTint : 'transparent' }}>
          <ReactionGlyph kind={k} size={size} />
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
}
