import { View, Text } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors } from '@/theme/index';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  /** md is the parent-app default (larger, AA-readable); sm for dense student/teacher UI */
  size?: 'sm' | 'md';
}

// Text colors are the dark AA-contrast variants, not the mid-tone brand colors.
const badgeColors: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: colors.surfaceSunken, text: colors.inkSoft },
  success: { bg: colors.successLight, text: colors.successText },
  warning: { bg: colors.warningLight, text: colors.warningText },
  danger: { bg: colors.dangerLight, text: colors.dangerText },
  info: { bg: colors.infoLight, text: colors.infoText },
};

export function Badge({ label, variant = 'default', size = 'md' }: BadgeProps) {
  const { bg, text } = badgeColors[variant];
  const isSm = size === 'sm';

  return (
    <View
      style={{
        backgroundColor: bg,
        paddingVertical: isSm ? 4 : 6,
        paddingHorizontal: isSm ? 10 : 12,
        borderRadius: 20,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: isSm ? 12 : 14,
          color: text,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
