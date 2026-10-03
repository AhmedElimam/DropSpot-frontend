import { memo } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormScreen, HeaderAction, HeaderCount } from '@/components/ui/Form';
import { useCourses } from '@/hooks/useCourses';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { formatNumber } from '@/utils/format';
import type { CourseSummary } from '@/api/courses';

function Meta({ icon, label, color = colors.textSecondary }: { icon: IconName; label: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={14} color={color} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color }}>{label}</Text>
    </View>
  );
}

/** One course: stripe by check-in readiness, name, grade chip, weekly label, counts. */
const CourseRow = memo(function CourseRow({ c, onPress }: { c: CourseSummary; onPress: (id: string) => void }) {
  const { t } = useTranslation();
  const located = c.phone_checkin_active;
  return (
    <TouchableOpacity onPress={() => onPress(c.id)} activeOpacity={0.85} accessibilityRole="button"
      style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, borderStartWidth: 5, borderStartColor: located ? colors.success : colors.warning, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="book" size={22} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{c.name}</Text>
            {c.grade_name ? (
              <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary }}>{c.grade_name}</Text>
              </View>
            ) : null}
          </View>
          {c.schedule_label ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{c.schedule_label}</Text>
          ) : null}
        </View>
        <Icon name="back" size={18} color={colors.textTertiary} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' }}>
        <Meta icon="children" label={t('form_ui.students_n', { n: formatNumber(c.students_count) })} />
        <Meta icon="calendar" label={t('form_ui.slots_n', { n: formatNumber(c.slot_count) })} />
        <Meta icon="location" label={t(located ? 'teacher.location_set' : 'teacher.location_missing')} color={located ? colors.success : colors.warning} />
      </View>
    </TouchableOpacity>
  );
});

/**
 * «المقررات» — the teacher's courses. Tap one for its settings, GPS anchor and weekly
 * slots; «+» creates one (manage_courses — the ability the API enforces, not the role).
 */
export default function TeacherCourses() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: courses, isLoading, refetch } = useCourses();
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const { can } = useActiveAbilities();
  const list = courses ?? [];
  const open = (id: string) => router.push(`/(teacher)/courses/${id}` as Href);

  return (
    <FormScreen title={t('teacher.courses_title')} scroll={false}
      right={(
        <>
          {list.length > 0 ? <HeaderCount n={list.length} /> : null}
          {can(ABILITY.MANAGE_COURSES) ? <HeaderAction icon="add" label={t('teacher.new_course')} onPress={() => router.push('/(teacher)/courses/create' as Href)} /> : null}
        </>
      )}>
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <CourseRow c={item} onPress={open} />}
          removeClippedSubviews initialNumToRender={8} maxToRenderPerBatch={8} windowSize={7}
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="book" title={t('teacher.courses_empty_title')} message={t('teacher.courses_empty_hint')} />}
        />
      )}
    </FormScreen>
  );
}
