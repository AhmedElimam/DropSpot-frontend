import { View, Text } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

interface EmptyStateProps {
  /** Semantic icon shown above the title (no icon-only meaning: title is required) */
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'empty', title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xxxl,
      }}
    >
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: colors.primaryLight,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <Icon name={icon} size={40} color={colors.primary} outline />
      </View>
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 18,
          color: colors.textPrimary,
          textAlign: 'center',
          marginBottom: spacing.sm,
        }}
      >
        {title}
      </Text>
      {message ? (
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 16,
            lineHeight: 24,
            color: colors.textSecondary,
            textAlign: 'center',
            marginBottom: spacing.xl,
          }}
        >
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={{ minWidth: 200, marginTop: spacing.md }} />
      ) : null}
    </View>
  );
}
