import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import { textPresets } from '@/theme/index';

export function QRScanner() {
  const { t } = useTranslation();
  return (
    <View style={{ padding: 20, alignItems: 'center' }}>
      <Text style={textPresets.body}>{t('common.not_available')}</Text>
    </View>
  );
}
