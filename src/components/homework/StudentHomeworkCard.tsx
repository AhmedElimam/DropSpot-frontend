import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { HomeworkRatingBadge, HomeworkStreakBadge, HomeworkSummaryRow } from './HomeworkChips';
import { formatDayDate } from '@/utils/format';
import { homeworkDay } from '@/api/homework';
import type { StudentDetail } from '@/api/students';

/**
 * «الواجبات» on the teacher's student profile: the rate in this teacher's courses and the
 * newest five (at most — the server caps it), each with its grade.
 */
export function StudentHomeworkCard({ homework }: { homework: NonNullable<StudentDetail['homework']> }) {
  const { t } = useTranslation();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md }}>
      <HomeworkStreakBadge n={homework.missed_streak} big />
      <HomeworkSummaryRow summary={homework.summary} />
      {homework.recent.slice(0, 5).map((h, i) => (
        <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.borderLight }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20, color: colors.textPrimary }} numberOfLines={2}>{h.body}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }} numberOfLines={1}>
              {[h.course_name, h.assigned_on ? formatDayDate(homeworkDay(h.assigned_on)) : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <HomeworkRatingBadge rating={h.rating} />
        </View>
      ))}
    </View>
  );
}
