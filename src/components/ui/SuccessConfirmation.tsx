import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { Button } from './Button';
import { Icon } from './Icon';

interface SuccessConfirmationProps {
  /** One plain sentence describing what just happened. */
  title: string;
  message?: string;
  doneLabel?: string;
  onDone: () => void;
}

/**
 * Full-screen, unmissable confirmation (elderly-usability rule: no small
 * toasts after important actions — a green check and one plain sentence).
 */
export function SuccessConfirmation({ title, message, doneLabel, onDone }: SuccessConfirmationProps) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xxxl,
        backgroundColor: colors.background,
      }}
    >
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: colors.successLight,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.xl,
        }}
      >
        <Icon name="success" size={56} color={colors.success} />
      </View>
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 22,
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
      <Button
        title={doneLabel || t('common.done')}
        onPress={onDone}
        style={{ minWidth: 220, marginTop: spacing.lg }}
      />
    </View>
  );
}
