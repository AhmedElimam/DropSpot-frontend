import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { Button } from './Button';
import { CallTeacherButton } from './CallTeacherButton';
import { Icon } from './Icon';

interface ErrorStateProps {
  /** Calm, human message. Never pass a raw API/server string here. */
  message?: string;
  onRetry?: () => void;
  /** When set, shows the "call the teacher" fallback under the retry button. */
  teacherPhone?: string | null;
  teacherName?: string | null;
}

export function ErrorState({ message, onRetry, teacherPhone, teacherName }: ErrorStateProps) {
  const { t } = useTranslation();

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
          backgroundColor: colors.warningLight,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <Icon name="warning" size={40} color={colors.warningText} outline />
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
        {t('errors.friendly_title')}
      </Text>
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
        {message || t('errors.friendly_body')}
      </Text>
      {onRetry ? (
        <Button title={t('common.retry')} onPress={onRetry} style={{ minWidth: 200 }} />
      ) : null}
      {teacherPhone ? (
        <CallTeacherButton phone={teacherPhone} name={teacherName} style={{ marginTop: spacing.md }} />
      ) : null}
    </View>
  );
}
