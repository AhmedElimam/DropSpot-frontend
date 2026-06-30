import { TouchableOpacity, Text, ActivityIndicator, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, gradients } from '@/theme/index';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const variantStyles: Record<string, { bg: readonly [string, string]; textColor: string }> = {
  primary: { bg: gradients.primary, textColor: colors.textInverse },
  secondary: { bg: ['#475569', '#64748B'] as const, textColor: colors.textInverse },
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
            paddingVertical: 14,
            paddingHorizontal: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            opacity: disabled ? 0.5 : 1,
            backgroundColor: 'transparent',
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
              fontSize: 16,
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
      style={[{ borderRadius: 12, overflow: 'hidden', opacity: disabled ? 0.5 : 1 }, style]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      <LinearGradient
        colors={config.bg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
      >
        {loading ? (
          <ActivityIndicator color={config.textColor} size="small" />
        ) : (
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 16,
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
