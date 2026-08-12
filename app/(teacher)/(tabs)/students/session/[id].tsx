import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/layout/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSessionDetail } from '@/hooks/useTeacherSessionHistory';
import type { SessionAttendee } from '@/api/teacherSessions';
import { dayLabel } from '@/utils/format';

const STATUS_META: Record<string, { key: string; variant: BadgeVariant }> = {
  present: { key: 'attendance.present', variant: 'success' },
  late: { key: 'attendance.late', variant: 'warning' },
  absent: { key: 'attendance.absent', variant: 'danger' },
  excused: { key: 'attendance.excused', variant: 'info' },
  not_recorded: { key: 'teacher.not_recorded', variant: 'default' },
};

export default function SessionDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: s, isLoading, refetch, isRefetching } = useSessionDetail(id);

  const renderAttendee = ({ item }: { item: SessionAttendee }) => {
    const meta = STATUS_META[item.status] ?? STATUS_META.not_recorded;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
        <Avatar name={item.name ?? '—'} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{item.name ?? '—'}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
            {item.student_code ?? ''}{item.checked_in_at ? ` · ${item.checked_in_at}` : ''}
          </Text>
        </View>
        <Badge label={t(meta.key)} variant={meta.variant} size="sm" />
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }} numberOfLines={1}>{s?.course_name ?? t('session.session_details')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : !s ? (
        <EmptyState icon="calendar" title={t('teacher.session_not_found')} />
      ) : (
        <FlatList
          data={s.attendees}
          keyExtractor={(a) => String(a.student_id)}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListHeaderComponent={
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>
                {dayLabel(s.scheduled_at)}{s.time ? ` · ${s.time}` : ''}{s.location ? ` · ${s.location}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
                <Icon name="present" size={18} color={colors.success} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>
                  {t('teacher.present_of_total', { present: s.present_count, total: s.total_count })}
                </Text>
              </View>
            </View>
          }
          renderItem={renderAttendee}
          ListEmptyComponent={<EmptyState icon="children" title={t('teacher.no_students')} />}
        />
      )}
    </View>
  );
}
