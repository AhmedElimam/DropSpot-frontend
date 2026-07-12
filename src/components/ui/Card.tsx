import { View, type ViewStyle, type StyleProp } from 'react-native';
import type { ReactNode } from 'react';
import { colors, radius, shadows } from '@/theme/index';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export function Card({ children, style, padded = true }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.sm,
        },
        padded && { padding: 16 },
        style,
      ]}
    >
      {children}
    </View>
  );
}
