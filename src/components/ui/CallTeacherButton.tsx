import { TouchableOpacity, Text, Linking, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, touchTarget } from '@/theme/index';
import { Icon } from './Icon';

interface CallTeacherButtonProps {
  phone: string;
  name?: string | null;
  style?: ViewStyle;
}

/**
 * The human fallback: a visible, labeled "call the teacher" action.
 * Every parent screen where someone can get stuck should surface this.
 */
export function CallTeacherButton({ phone, name, style }: CallTeacherButtonProps) {
  const { t } = useTranslation();
  const label = name ? t('common.call_teacher_named', { name }) : t('common.call_teacher');

  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(`tel:${phone}`)}
      activeOpacity={0.8}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        {
          minHeight: touchTarget.minHeight,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 12,
          paddingHorizontal: 24,
          borderRadius: 12,
          backgroundColor: colors.successLight,
          borderWidth: 1.5,
          borderColor: colors.success,
        },
        style,
      ]}
    >
      <Icon name="call" size={20} color={colors.successText} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.successText }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
