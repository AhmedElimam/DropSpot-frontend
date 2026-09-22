import { View, Text, TouchableOpacity } from 'react-native';
import { memo, useCallback } from 'react';
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

// memo: this is a FlatList row. Without it every mounted row re-rendered whenever the
// parent did — which on the roster screen is on EVERY KEYSTROKE of the search box,
// because filtering happens client-side over the whole (unpaginated) roster. With a few
// hundred students that was hundreds of full row re-renders per character typed, and it
// is a large part of why typing and scrolling felt slow and ran the phone hot on a
// mid-range chip (Redmi Note 11S, 2026-09-22). The props are all primitives, so the
// default shallow compare is exactly right — provided `onPress` is stable, which is why
// the handler below is wrapped rather than recreated inline.
export const StudentRow = memo(function StudentRow({ id, name, studentCode, grade, status, attendanceRate, onPress }: StudentRowProps) {
  const { t } = useTranslation();
  const handlePress = useCallback(() => onPress?.(id), [onPress, id]);

  const statusConfig = status
    ? {
        present: { label: t('attendance.present'), variant: 'success' as const },
        absent: { label: t('attendance.absent'), variant: 'danger' as const },
        late: { label: t('attendance.late'), variant: 'warning' as const },
      }[status]
    : null;

  return (
    <TouchableOpacity
      onPress={handlePress}
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
        <View style={{ marginStart: spacing.sm }}>
          <Text style={{ fontSize: 14, color: colors.textTertiary }}>{'<'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});
