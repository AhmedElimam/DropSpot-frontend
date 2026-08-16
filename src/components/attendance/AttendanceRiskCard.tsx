import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, fonts } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import type { AttendanceRisk } from '@/api/attendanceRisk';

/**
 * A calm early warning that a run of consecutive unexcused absences has put an
 * enrollment at risk of the teacher removing the student. Deliberately actionable,
 * not alarming: it tells the family to excuse the absence or contact the teacher.
 * `showName` adds the child's name (parent view, multiple children).
 */
export function AttendanceRiskCard({ risk, showName }: { risk: AttendanceRisk; showName?: boolean }) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        backgroundColor: colors.warningLight, borderWidth: 1, borderColor: colors.warning,
        borderRadius: radius.xl, padding: spacing.xl, borderStartWidth: 4, borderStartColor: colors.warning,
        flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
      }}
    >
      <Icon name="warning" size={22} color={colors.warningText} outline />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.warningText }}>
          {t('attendance.risk_title')}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.warningText, marginTop: 4 }}>
          {showName
            ? t('attendance.risk_desc_parent', { name: risk.student_name ?? '', count: risk.absences, course: risk.course_name ?? '' })
            : t('attendance.risk_desc', { count: risk.absences, course: risk.course_name ?? '' })}
        </Text>
        {risk.teacher_name ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Icon name="teacher" size={14} color={colors.warningText} outline style={{ marginEnd: 3 }} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.warningText }}>{risk.teacher_name}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
