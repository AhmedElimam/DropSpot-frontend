import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, fonts } from '@/theme/index';
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
        backgroundColor: colors.warnWash, borderWidth: 1, borderColor: '#F7E1C6',
        borderRadius: 18, padding: 14, paddingHorizontal: 15,
        flexDirection: 'row', gap: spacing.md, alignItems: 'center',
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="warning" size={18} color={colors.warn} outline />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>
          {t('attendance.risk_title')}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 2 }}>
          {showName
            ? t('attendance.risk_desc_parent', { name: risk.student_name ?? '', count: risk.absences, course: risk.course_name ?? '' })
            : t('attendance.risk_desc', { count: risk.absences, course: risk.course_name ?? '' })}
        </Text>
      </View>
    </View>
  );
}
