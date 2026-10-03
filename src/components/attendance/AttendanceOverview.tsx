import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { PercentRing } from '@/components/ui/PercentRing';
import { formatNumber } from '@/utils/format';

/**
 * The attendance figure at a glance: the rate as a ring, and present / excused / absent
 * as tinted rows beside it with a «x of y recorded» line. The same block on the student
 * home, the student attendance page and the parent's child page.
 */
export function AttendanceOverview({ present, late = 0, absent, excused, ringSize = 104, caption }: {
  present: number; late?: number; absent: number; excused: number; ringSize?: number; caption?: string;
}) {
  const { t } = useTranslation();
  const attended = present + late;
  const total = attended + absent + excused;
  const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
  const rows: { key: string; label: string; value: number; fg: string; bg: string }[] = [
    { key: 'present', label: t('attendance.present'), value: attended, fg: colors.successText, bg: colors.successLight },
    { key: 'excused', label: t('attendance.excused'), value: excused, fg: colors.infoText, bg: colors.infoLight },
    { key: 'absent', label: t('attendance.absent'), value: absent, fg: colors.dangerText, bg: colors.dangerLight },
  ];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      <PercentRing value={pct} size={ringSize} caption={caption ?? t('home.attendance_ring_label')} />
      <View style={{ flex: 1, gap: 6 }}>
        {rows.map((r) => (
          <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: r.bg, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: spacing.md }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: r.fg }}>{r.label}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: r.fg }}>{formatNumber(r.value)}</Text>
          </View>
        ))}
        <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 2 }}>
          {t('home.attendance_ring_hint', { present: formatNumber(attended), total: formatNumber(total) })}
        </Text>
      </View>
    </View>
  );
}
