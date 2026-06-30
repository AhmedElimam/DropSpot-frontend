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
          backgroundColor: colors.white,
          borderRadius: radius.xl,
          ...shadows.md,
        },
        padded && { padding: 16 },
        style,
      ]}
    >
      {children}
    </View>
  );
}
