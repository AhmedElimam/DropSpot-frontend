import { View, Text, TouchableOpacity } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing, shadows } from '@/theme/index';
import { Avatar } from '@/components/layout/Avatar';
import { useTranslation } from 'react-i18next';

interface TeacherRowProps {
  id: string;
  name: string;
  subject?: string;
  courseCount?: number;
  onPress?: (id: string) => void;
}

export function TeacherRow({ id, name, subject, courseCount, onPress }: TeacherRowProps) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      onPress={() => onPress?.(id)}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        ...shadows.sm,
      }}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${name} - ${subject || ''}`}
    >
      <Avatar name={name} size={44} />

      <View style={{ flex: 1, marginHorizontal: spacing.md }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
          {name}
        </Text>
        {subject && (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
            {subject}
          </Text>
        )}
      </View>

      {courseCount !== undefined && (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>
          {courseCount} {t('session.course')}
        </Text>
      )}

      {onPress && (
        <View style={{ transform: [{ scaleX: -1 }], marginStart: spacing.sm }}>
          <Text style={{ fontSize: 14, color: colors.textTertiary }}>{'<'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
