import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/layout/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useStudentDetail } from '@/hooks/useStudents';
import { dayLabel, formatDayDate } from '@/utils/format';

// Attendance status → an i18n key + Badge variant. 'not_recorded' is the neutral
// "no record for this session" state (only appears in session detail, kept here
// for completeness).
const STATUS_META: Record<string, { key: string; variant: BadgeVariant }> = {
  present: { key: 'attendance.present', variant: 'success' },
  late: { key: 'attendance.late', variant: 'warning' },
  absent: { key: 'attendance.absent', variant: 'danger' },
  excused: { key: 'attendance.excused', variant: 'info' },
  not_recorded: { key: 'teacher.not_recorded', variant: 'default' },
};

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, color }}>{value}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.md }}>{title}</Text>
      {children}
    </View>
  );
}

export default function StudentDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: s, isLoading, refetch, isRefetching } = useStudentDetail(id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }} numberOfLines={1}>{s?.name ?? t('teacher.tab_students')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : !s ? (
        <EmptyState icon="child" title={t('teacher.student_not_found')} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        >
          {/* Summary */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}>
            <Avatar name={s.name ?? '—'} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{s.name ?? '—'}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                {s.grade_name ?? t('teacher.no_grade')}{s.student_code ? ` · ${s.student_code}` : ''}
              </Text>
            </View>
          </View>

          {/* Attendance summary */}
          <Section title={t('teacher.attendance_summary')}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <StatTile label={t('teacher.stat_attended')} value={s.attendance_stats.attended} color={colors.success} />
              <StatTile label={t('teacher.stat_absent')} value={s.attendance_stats.absent} color={colors.danger} />
              <StatTile label={t('teacher.stat_excused')} value={s.attendance_stats.excused} color={colors.info} />
              <StatTile label={t('teacher.stat_total')} value={s.attendance_stats.total} color={colors.textPrimary} />
            </View>
          </Section>

          {/* Billing */}
          <Section title={t('teacher.billing_section')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: s.billing.has_overdue ? colors.danger : colors.border, padding: spacing.lg }}>
              <Icon name="money" size={24} color={s.billing.has_overdue ? colors.danger : colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: s.billing.has_overdue ? colors.danger : colors.textPrimary }}>
                  {s.billing.has_overdue ? `${t('teacher.billing_overdue')} · ${s.billing.overdue_amount} ${t('teacher.egp')}` : t('teacher.billing_clear')}
                </Text>
                {s.billing.override_active ? (
                  <View style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                    <Badge label={t('teacher.billing_override_active')} variant="info" size="sm" />
                    {s.billing.override_expires_at ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>
                        {t('teacher.override_until', { date: formatDayDate(s.billing.override_expires_at) })}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          </Section>

          {/* Courses */}
          {s.courses.length > 0 ? (
            <Section title={t('teacher.student_courses')}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {s.courses.map((c) => (
                  <View key={c.id} style={{ backgroundColor: colors.brandTint, borderRadius: radius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{c.name ?? '—'}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {/* Parents */}
          {s.parents.length > 0 ? (
            <Section title={t('teacher.student_parents')}>
              {s.parents.map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{p.name ?? '—'}</Text>
                      {p.is_primary ? <Badge label={t('teacher.primary_parent')} variant="success" size="sm" /> : null}
                    </View>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                      {p.relationship ?? ''}{p.phone ? ` · ${p.phone}` : ` · ${t('teacher.no_phone')}`}
                    </Text>
                  </View>
                  {p.phone ? (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${p.phone}`)} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.successLight, justifyContent: 'center', alignItems: 'center' }}>
                      <Icon name="call" size={20} color={colors.success} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </Section>
          ) : null}

          {/* Attendance history */}
          <Section title={t('teacher.attendance_history')}>
            {s.attendance.length === 0 ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{t('teacher.no_attendance')}</Text>
            ) : (
              s.attendance.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.not_recorded;
                return (
                  <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{r.course_name ?? '—'}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{dayLabel(r.date)}</Text>
                    </View>
                    <Badge label={t(meta.key)} variant={meta.variant} size="sm" />
                  </View>
                );
              })
            )}
          </Section>
        </ScrollView>
      )}
    </View>
  );
}
