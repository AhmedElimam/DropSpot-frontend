import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';

interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: { label: string; onPress: () => void };
}

export function ScreenHeader({ title, showBack = true, rightAction }: ScreenHeaderProps) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
      }}
    >
      {showBack ? (
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <View style={{ transform: [{ scaleX: -1 }] }}>
            <Text style={{ fontSize: 20, color: colors.primary }}>{'<'}</Text>
          </View>
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 14,
              color: colors.primary,
              marginStart: spacing.sm,
            }}
          >
            {t('common.back')}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 19,
          color: colors.textPrimary,
          textAlign: 'center',
          flex: 2,
        }}
      >
        {title}
      </Text>

      {rightAction ? (
        <TouchableOpacity
          onPress={rightAction.onPress}
          style={{ flex: 1, alignItems: 'flex-end' }}
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.primary }}>
            {rightAction.label}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={{ flex: 1 }} />
      )}
    </View>
  );
}
