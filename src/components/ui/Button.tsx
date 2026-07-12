import { TouchableOpacity, Text, ActivityIndicator, type ViewStyle } from 'react-native';
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
const variantStyles: Record<string, { bg: readonly [string, string]; textColor: string }> = {
  primary: { bg: gradients.primary, textColor: colors.textInverse },
  accent: { bg: gradients.accent, textColor: colors.onAccent },
  success: { bg: gradients.success, textColor: colors.textInverse },
  secondary: { bg: ['#4A57B5', '#3A46A8'] as const, textColor: colors.textInverse },
  destructive: { bg: [colors.dangerDark, colors.danger] as const, textColor: colors.textInverse },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
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
            paddingHorizontal: 24,
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
            style={{
              fontFamily: fonts.bold,
              fontSize: 17,
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

  const config = variantStyles[variant] || variantStyles.primary;

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
        style={{ minHeight: control.minHeight, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
      >
        {loading ? (
          <ActivityIndicator color={config.textColor} size="small" />
        ) : (
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 17,
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
