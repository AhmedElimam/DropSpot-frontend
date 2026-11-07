import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { GroupFilter, useGroupFilter } from '@/components/teacher/GroupFilter';
import { formatNumber } from '@/utils/format';
import type { InvitationCourseOption } from '@/api/invitation';

/** The card every door's page is built from (fast register's look). Read at render: theme tokens are live. */
export const sectionCardStyle = () => ({
  backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border,
  padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm,
}) as const;

/**
 * «اختر المجموعة» — the course list fast register opened with, shared by every way in (fast
 * register, QR / card, phone invite; founder 2026-11-07: «UI not like the fast register»).
 * Search, grade and «الفترة» filters, each course with its weekly times, a count of who was
 * added to it in this sitting, and the door's own action icon.
 */
export function CoursePickCard({ courses, onPick, title, hint, actionIcon = 'add', counts, emptyText }: {
  courses: InvitationCourseOption[];
  onPick: (c: InvitationCourseOption) => void;
  title?: string;
  hint?: string;
  actionIcon?: IconName;
  counts?: Record<number, number>;
  emptyText?: string;
}) {
  const { t } = useTranslation();
  const groups = useGroupFilter(courses, (c) => `${c.name} ${c.grade_name ?? ''}`, (c) => c.grade_name, (c) => c.shift);
  return (
    <View style={sectionCardStyle()}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }}>{title ?? t('fast_register.pick_group')}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md }}>{hint ?? t('fast_register.pick_group_hint')}</Text>
      <GroupFilter grades={groups.grades} grade={groups.grade} onGrade={groups.setGrade} query={groups.query} onQuery={groups.setQuery} searchable={groups.searchable} hasShifts={groups.hasShifts} shift={groups.shift} onShift={groups.setShift} />
      {courses.length === 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary }}>{emptyText ?? t('enroll_ui.no_scheduled_courses')}</Text>
      ) : groups.filtered.length === 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary }}>{t('group_filter.none')}</Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {groups.filtered.map((c) => {
            const n = counts?.[c.id] ?? 0;
            return (
              <TouchableOpacity key={c.id} onPress={() => onPick(c)} activeOpacity={0.85} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="book" size={19} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{c.name}{c.grade_name ? ` · ${c.grade_name}` : ''}</Text>
                  {c.schedule_label
                    ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{c.schedule_label}</Text>
                    : <Text onPress={() => router.push(`/(teacher)/courses/${c.id}` as never)} style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand, marginTop: 2 }}>{t('fast_register.no_slots')}</Text>}
                </View>
                {n > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.successLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Icon name="success" size={12} color={colors.successText} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.successText }}>{formatNumber(n)}</Text>
                  </View>
                ) : null}
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={actionIcon} size={18} color={colors.onPrimary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
