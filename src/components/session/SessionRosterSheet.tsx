import { View, Text, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/layout/Avatar';
import { avatarSeed } from '@/components/ui/GeneratedAvatar';
import { useSessionDetail } from '@/hooks/useTeacherSessionHistory';
import { formatNumber } from '@/utils/format';
import type { SessionAttendee } from '@/api/teacherSessions';

const STATUS_COLOR = (): Record<string, string> => ({
  present: colors.success, late: colors.warning, absent: colors.danger, excused: colors.info, not_recorded: colors.borderStrong,
});
const STATUS_KEY: Record<string, string> = {
  present: 'attendance.present', late: 'attendance.late', absent: 'attendance.absent', excused: 'attendance.excused', not_recorded: 'teacher.not_recorded',
};
// Who still needs a decision first, then the late, absent, excused, and the present last.
const ORDER: Record<string, number> = { not_recorded: 0, late: 1, absent: 2, excused: 3, present: 4 };

/**
 * A quick look at one session's «كشف الحضور» from the teacher's home (founder 2026-10-04:
 * swipe a session card from left to right → the students). Read-only: who is here, who is
 * late, who has not been recorded yet. Marking, grades and notes stay on the full sheet,
 * one tap away at the bottom.
 */
export function SessionRosterSheet({ sessionId, onClose, onOpenFull }: {
  sessionId: string | null;
  onClose: () => void;
  onOpenFull: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const q = useSessionDetail(sessionId ?? undefined);
  const s = sessionId ? q.data : undefined;
  const attendees: SessionAttendee[] = [...(s?.attendees ?? []), ...(s?.swap_ins ?? [])]
    .sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || (a.name ?? '').localeCompare(b.name ?? '', 'ar'));
  const present = attendees.filter((a) => a.status === 'present' || a.status === 'late').length;

  return (
    <SheetModal visible={!!sessionId} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="attendance" size={22} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }} numberOfLines={1}>{s?.course_name ?? t('home.roster_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
            {[s?.time, s ? t('home.roster_count', { present: formatNumber(present), total: formatNumber(attendees.length) }) : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {q.isLoading || (!s && !!sessionId && !q.isError) ? (
        <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />
      ) : attendees.length === 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xl }}>{t('home.roster_empty')}</Text>
      ) : (
        <ScrollView style={{ maxHeight: height * 0.55 }} showsVerticalScrollIndicator={false}>
          {attendees.map((a) => {
            const color = STATUS_COLOR()[a.status] ?? STATUS_COLOR().not_recorded;
            return (
              <View key={a.student_id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                <Avatar name={a.name ?? '—'} seed={avatarSeed.student(a.student_id, a.name ?? '—')} size={36} />
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{a.name ?? '—'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: colors.surfaceSunken }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary }}>{t(STATUS_KEY[a.status] ?? 'teacher.not_recorded')}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {sessionId ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button title={t('home.roster_open_full')} onPress={() => onOpenFull(sessionId)} variant="primary" />
        </View>
      ) : null}
    </SheetModal>
  );
}
