import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows, gradients } from '@/theme/index';
import { useTranslation } from 'react-i18next';

interface CheckInButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  checkedIn?: boolean;
}

export function CheckInButton({
  onPress,
  loading = false,
  disabled = false,
  checkedIn = false,
}: CheckInButtonProps) {
  const { t } = useTranslation();

  if (checkedIn) {
    return (
      <View
        style={{
          backgroundColor: '#D1FAE5',
          paddingVertical: 14,
          paddingHorizontal: 24,
          borderRadius: radius.lg,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#065F46' }}>
          {t('attendance.checked_in_success')}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessible
      accessibilityRole="button"
      accessibilityLabel={t('attendance.check_in_now')}
    >
      <LinearGradient
        colors={disabled ? ['#9CA3AF', '#9CA3AF'] : gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 24,
          borderRadius: radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          opacity: disabled ? 0.5 : 1,
          ...shadows.md,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' }}>
            {t('attendance.check_in_now')}
          </Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}
