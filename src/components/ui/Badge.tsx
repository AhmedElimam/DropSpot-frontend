import { View, Text } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors } from '@/theme/index';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const badgeColors: Record<string, { bg: string; text: string }> = {
  default: { bg: '#F1F5F9', text: '#475569' },
  success: { bg: colors.successLight, text: colors.success },
  warning: { bg: colors.warningLight, text: colors.warning },
  danger: { bg: colors.dangerLight, text: colors.danger },
  info: { bg: colors.primaryLight, text: colors.primary },
};

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const { bg, text } = badgeColors[variant];

  return (
    <View
      style={{
        backgroundColor: bg,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 20,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: 11,
          color: text,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
