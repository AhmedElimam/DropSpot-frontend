import { View, Text } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';

interface StatsCardProps {
  label: string;
  value: string | number;
  color?: string;
  bgColor?: string;
}

export function StatsCard({ label, value, color = colors.primary, bgColor = colors.primaryLight }: StatsCardProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bgColor,
        borderRadius: radius.md,
        padding: spacing.md,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 22,
          color,
          marginBottom: spacing.xs,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: fonts.regular,
          fontSize: 12,
          color: colors.textSecondary,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
