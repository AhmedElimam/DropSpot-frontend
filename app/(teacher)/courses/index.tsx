import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCourses } from '@/hooks/useCourses';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import type { CourseSummary } from '@/api/courses';

/**
 * Teacher "المقررات" — mobile parity with the web /courses list. Tap a course to
 * open its settings, GPS location capture, and weekly slots. Reached from Settings.
 */
export default function TeacherCourses() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: courses, isLoading, refetch } = useCourses();
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const { isAssistant } = useActiveAbilities();

  const renderCourse = ({ item }: { item: CourseSummary }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(teacher)/courses/${item.id}` as Href)}
      activeOpacity={0.85}
      style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
          {item.name}
        </Text>
        <Icon name="back" size={20} color={colors.textTertiary} />
      </View>
      {item.grade_name ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{item.grade_name}</Text>
      ) : null}
      {item.schedule_label ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <Icon name="calendar" size={13} color={colors.textTertiary} outline />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }}>{item.schedule_label}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, flexWrap: 'wrap' }}>
        <Meta icon="children" label={t('teacher.students_count', { count: item.students_count })} />
        <Meta icon="calendar" label={t('teacher.slots_count', { count: item.slot_count })} />
        {item.phone_checkin_active ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="location" size={15} color={colors.success} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.success }}>{t('teacher.location_set')}</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="location" size={15} color={colors.warning} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.warning }}>{t('teacher.location_missing')}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.courses_title')}</Text>
        {/* Course creation is teacher-only (the API rejects assistants). */}
        {!isAssistant ? (
          <TouchableOpacity
            onPress={() => router.push('/(teacher)/courses/create' as Href)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.full, backgroundColor: colors.brand }}
          >
            <Icon name="add" size={18} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('teacher.new_course')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (courses ?? []).length === 0 ? (
        <EmptyState icon="book" title={t('teacher.courses_empty_title')} message={t('teacher.courses_empty_hint')} />
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(c) => c.id}
          renderItem={renderCourse}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom, paddingTop: spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}
    </View>
  );
}

function Meta({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={15} color={colors.textTertiary} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{label}</Text>
    </View>
  );
}
