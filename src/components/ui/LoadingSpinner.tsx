import { View, ActivityIndicator, Text } from 'react-native';
import { fonts } from '@/theme/typography';
import { useTranslation } from 'react-i18next';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message }: LoadingSpinnerProps) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}
    >
      <ActivityIndicator size="large" color="#208AEF" />
      <Text
        style={{
          fontFamily: fonts.regular,
          fontSize: 14,
          color: '#6B7280',
          marginTop: 12,
        }}
      >
        {message || t('common.loading')}
      </Text>
    </View>
  );
}
