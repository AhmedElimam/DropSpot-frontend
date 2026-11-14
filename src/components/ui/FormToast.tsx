import { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

/** How long a form's «what's missing» note stays before it slips away on its own. */
export const FORM_TOAST_MS = 5000;

export type FormToastMessage = { title: string; lines: string[]; seq: number };

/**
 * A form's «what's missing» note (founder 2026-11-14): floats at the bottom over the form, one
 * short slide in (transform + opacity, once — no endless motion), a tap or five seconds takes
 * it away. Not a modal: nothing stacks, nothing blocks the form behind it. `seq` re-shows the
 * same words on a second press.
 */
export function FormToast({ message, onHide }: { message: FormToastMessage | null; onHide: () => void }) {
  const insets = useSafeAreaInsets();
  const shown = useSharedValue(0);
  const seq = message?.seq ?? 0;

  useEffect(() => {
    if (!message) { shown.value = 0; return undefined; }
    shown.value = 0;
    shown.value = withTiming(1, { duration: 200 });
    const timer = setTimeout(onHide, FORM_TOAST_MS);
    return () => clearTimeout(timer);
  }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: (1 - shown.value) * 24 }] }));
  if (!message) return null;

  return (
    <Animated.View pointerEvents="box-none" style={[{ position: 'absolute', left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md }, style]}>
      <TouchableOpacity onPress={onHide} activeOpacity={0.9} accessibilityRole="alert" accessibilityLiveRegion="polite"
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger, ...shadows.lg }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="warning" size={16} color={colors.dangerText} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{message.title}</Text>
          {/* A drawn dot, not «•»: a dot glyph beside Arabic digits reads as a zero. */}
          {message.lines.map((line, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.danger, marginTop: 8 }} />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>{line}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
