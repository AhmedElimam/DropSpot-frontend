import { View, TextInput, Text } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
}

export function SearchBar({ value, onChangeText, placeholder, onFocus }: SearchBarProps) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Icon name="search" size={18} color={colors.textTertiary} outline style={{ marginEnd: spacing.sm }} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || t('common.search')}
        placeholderTextColor={colors.textTertiary}
        onFocus={onFocus}
        style={{
          flex: 1,
          fontFamily: fonts.regular,
          fontSize: 14,
          color: colors.textPrimary,
          paddingVertical: spacing.xs,
          textAlign: 'right',
        }}
      />
      {value.length > 0 && (
        <Text
          onPress={() => onChangeText('')}
          style={{ fontSize: 16, color: colors.textTertiary, paddingStart: spacing.sm }}
        >
          {'✕'}
        </Text>
      )}
    </View>
  );
}
