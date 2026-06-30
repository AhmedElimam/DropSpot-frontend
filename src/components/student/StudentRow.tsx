import { View, Text, TouchableOpacity } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing, shadows } from '@/theme/index';
import { Avatar } from '@/components/layout/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useTranslation } from 'react-i18next';

interface StudentRowProps {
  id: string;
  name: string;
  studentCode: string;
  grade?: string;
  status?: 'present' | 'absent' | 'late' | null;
  attendanceRate?: number;
  onPress?: (id: string) => void;
}

export function StudentRow({ id, name, studentCode, grade, status, attendanceRate, onPress }: StudentRowProps) {
  const { t } = useTranslation();

  const statusConfig = status
    ? {
        present: { label: t('attendance.present'), variant: 'success' as const },
        absent: { label: t('attendance.absent'), variant: 'danger' as const },
        late: { label: t('attendance.late'), variant: 'warning' as const },
      }[status]
    : null;

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
      accessibilityLabel={`${name} - ${studentCode}`}
    >
      <Avatar name={name} size={44} />

      <View style={{ flex: 1, marginHorizontal: spacing.md }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
          {name}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
          {studentCode}{grade ? ` | ${grade}` : ''}
        </Text>
      </View>

      {statusConfig && (
        <Badge label={statusConfig.label} variant={statusConfig.variant} />
      )}

      {attendanceRate !== undefined && (
        <Text
          style={{
            fontFamily: fonts.bold,
            fontSize: 14,
            color: attendanceRate >= 75 ? colors.success : colors.danger,
          }}
        >
          {attendanceRate}%
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
