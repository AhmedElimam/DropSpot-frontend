import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, fonts } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import type { AttendanceRisk } from '@/api/attendanceRisk';

/**
 * A calm early warning that a run of consecutive unexcused absences has put an enrollment
 * at risk. One compact row (founder 2026-10-03): the course and count in the title, what to
 * do in one line, the teacher as a tag. `showName` adds the child's name (parent view).
 */
export function AttendanceRiskCard({ risk, showName }: { risk: AttendanceRisk; showName?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.warningLight, borderWidth: 1, borderColor: colors.warning, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderStartWidth: 4, borderStartColor: colors.warning, minHeight: 60 }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="warning" size={19} color={colors.warningText} outline />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.warningText }} numberOfLines={1}>
          {t('attendance.risk_title')}{risk.course_name ? ` · ${risk.course_name}` : ''}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.warningText, marginTop: 1 }} numberOfLines={2}>
          {showName
            ? t('attendance.risk_desc_parent', { name: risk.student_name ?? '', count: risk.absences, course: risk.course_name ?? '' })
            : t('attendance.risk_desc', { count: risk.absences, course: risk.course_name ?? '' })}
          {risk.teacher_name ? ` · ${risk.teacher_name}` : ''}
        </Text>
      </View>
    </View>
  );
}
