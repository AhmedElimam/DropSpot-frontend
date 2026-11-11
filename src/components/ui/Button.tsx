import { TouchableOpacity, Text, ActivityIndicator, useWindowDimensions, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, gradients, control } from '@/theme/index';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'success' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

// Sanad: grounded indigo primary, apricot accent for the single human moment,
// muted green for positive confirmations. 52px tall — thumb-sized for elders.
const variantStyles = (): Record<string, { bg: readonly [string, string]; textColor: string }> => ({
  primary: { bg: gradients.primary, textColor: colors.textInverse },
  accent: { bg: gradients.accent, textColor: colors.onAccent },
  success: { bg: gradients.success, textColor: colors.textInverse },
  secondary: { bg: ['#4A57B5', '#3A46A8'] as const, textColor: colors.textInverse },
  destructive: { bg: [colors.dangerDark, colors.danger] as const, textColor: colors.textInverse },
});

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  // Responsive label (founder 2026-11-01: «the text inside some buttons is too big»): smaller on
  // narrow phones, never wider than the button (shrinks to fit, one line), and the system text
  // size can grow it only a little — a half-width button in a row stays readable.
  const { width } = useWindowDimensions();
  const narrow = width < 380;
  const labelProps = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.72, maxFontSizeMultiplier: 1.15 } as const;
  const fontSize = narrow ? 15.5 : 17;
  const padX = narrow ? 16 : 24;
  if (variant === 'outline' || variant === 'ghost') {
    const isOutline = variant === 'outline';
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.7}
        style={[
          {
            minHeight: control.minHeight,
            paddingVertical: 14,
            paddingHorizontal: padX,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            opacity: disabled ? 0.5 : 1,
            backgroundColor: isOutline ? 'transparent' : colors.brandTint,
            borderWidth: isOutline ? 1.5 : 0,
            borderColor: isOutline ? colors.primary : 'transparent',
          },
          style,
        ]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Text
            {...labelProps}
            style={{
              flexShrink: 1,
              fontFamily: fonts.bold,
              fontSize,
              textAlign: 'center',
              color: colors.primary,
            }}
          >
            {title}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  const config = variantStyles()[variant] || variantStyles().primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[{ borderRadius: 14, overflow: 'hidden', opacity: disabled ? 0.5 : 1 }, style]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      <LinearGradient
        colors={config.bg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ minHeight: control.minHeight, paddingVertical: 14, paddingHorizontal: padX, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
      >
        {loading ? (
          <ActivityIndicator color={config.textColor} size="small" />
        ) : (
          <Text
            {...labelProps}
            style={{
              flexShrink: 1,
              fontFamily: fonts.bold,
              fontSize,
              textAlign: 'center',
              color: config.textColor,
            }}
          >
            {title}
          </Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}
