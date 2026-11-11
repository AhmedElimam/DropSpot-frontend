import { memo, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips, type ChipOption } from '@/components/ui/FilterChips';
import { FormScreen, HeaderAction, HeaderCount } from '@/components/ui/Form';
import { useCourses } from '@/hooks/useCourses';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatNumber } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import type { CourseSummary } from '@/api/courses';
import { useShiftSettingsStore } from '@/stores/shiftSettingsStore';
import { formatTime12 } from '@/components/ui/TimePicker';

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
  // A private lesson has no door: no location to be missing, the server's label instead.
  const noDoor = c.tracks_attendance === false;
  return (
    <TouchableOpacity onPress={() => onPress(c.id)} activeOpacity={0.85} accessibilityRole="button"
      style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, borderStartWidth: 5, borderStartColor: noDoor ? colors.brand : located ? colors.success : colors.warning, padding: spacing.md, marginBottom: spacing.sm }}>
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
            {c.shift ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.brandTint, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
                <Icon name={c.shift} size={11} color={colors.brand} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.brand }}>{c.shift_label ?? t(`course_shift.${c.shift}`)}</Text>
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
        {/* Kept from assistants: the whole course, or some of its groups. */}
        {c.hidden_from_assistants
          ? <Meta icon="eyeOff" label={t('course_ui.hidden_chip')} color={colors.brand} />
          : (c.hidden_groups_count ?? 0) > 0
            ? <Meta icon="eyeOff" label={c.hidden_groups_count === 1 ? t('course_ui.hidden_group_chip') : t('course_ui.hidden_groups_chip', { n: formatNumber(c.hidden_groups_count ?? 0) })} color={colors.brand} />
            : null}
        {noDoor
          ? <Meta icon="attendance" label={c.attendance_label ?? t('course_ui.private_label')} color={colors.brand} />
          : <Meta icon="location" label={t(located ? 'teacher.location_set' : 'teacher.location_missing')} color={located ? colors.success : colors.warning} />}
      </View>
    </TouchableOpacity>
  );
});

type CourseKind = 'all' | 'groups' | 'private';
type ShiftFilter = 'all' | 'morning' | 'evening';

/**
 * «المقررات» — the teacher's courses. Tap one for its settings, GPS anchor and weekly
 * slots; «+» creates one (manage_courses — the ability the API enforces, not the role).
 */
export default function TeacherCourses() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: courses, isLoading, refetch } = useCourses();
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const all = courses ?? [];
  // Groups vs private lessons — the row only appears once the teacher has both kinds.
  const [kind, setKind] = useState<CourseKind>('all');
  const privateCount = useMemo(() => all.filter((c) => c.tracks_attendance === false).length, [all]);
  const mixed = privateCount > 0 && privateCount < all.length;
  // «الفترة» — once the teacher switches «الفترات» on (founder 2026-11-07); courses file
  // themselves by their groups' times.
  const shiftSettings = useShiftSettingsStore((s) => s.settings);
  const [shift, setShift] = useState<ShiftFilter>('all');
  const morningCount = useMemo(() => all.filter((c) => c.shift === 'morning').length, [all]);
  const eveningCount = useMemo(() => all.filter((c) => c.shift === 'evening').length, [all]);
  const hasShifts = !!shiftSettings?.enabled && all.length > 0;
  const list = useMemo(() => {
    const byKind = !mixed || kind === 'all' ? all : all.filter((c) => (c.tracks_attendance === false) === (kind === 'private'));
    return !hasShifts || shift === 'all' ? byKind : byKind.filter((c) => c.shift === shift);
  }, [all, kind, mixed, shift, hasShifts]);
  const shifts: ChipOption<ShiftFilter>[] = [
    { key: 'all', label: t('course_shift.filter_all') },
    { key: 'morning', label: t('course_shift.filter_morning', { n: formatNumber(morningCount) }) },
    { key: 'evening', label: t('course_shift.filter_evening', { n: formatNumber(eveningCount) }) },
  ];
  const kinds: ChipOption<CourseKind>[] = [
    { key: 'all', label: t('course_ui.filter_all', { n: formatNumber(all.length) }) },
    { key: 'groups', label: t('course_ui.filter_groups', { n: formatNumber(all.length - privateCount) }) },
    { key: 'private', label: t('course_ui.filter_private', { n: formatNumber(privateCount) }) },
  ];
  const open = (id: string) => router.push(`/(teacher)/courses/${id}` as Href);

  return (
    <Surface id="screen.teacher.courses" screen>
    <FormScreen title={t('teacher.courses_title')} scroll={false}
      right={(
        <>
          {all.length > 0 ? <HeaderCount n={all.length} /> : null}
          <Surface id="teacher.courses.new_button" assistantNeeds="manage_courses"><HeaderAction icon="add" label={t('teacher.new_course')} onPress={() => router.push('/(teacher)/courses/create' as Href)} /></Surface>
        </>
      )}>
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <>
        {mixed ? <Surface id="teacher.courses.filter_kind"><FilterChips options={kinds} value={kind} onChange={setKind} /></Surface> : null}
        {hasShifts ? <Surface id="teacher.courses.filter_shift"><FilterChips options={shifts} value={shift} onChange={setShift} /></Surface> : null}
        <Surface id="teacher.courses.shift_settings" assistantNeeds="teacher">
          <TouchableOpacity onPress={() => router.push('/(teacher)/courses/shifts' as Href)} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.sm, paddingHorizontal: spacing.md, minHeight: 44,
              borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight }}>
            <Icon name="morning" size={18} color={shiftSettings?.enabled ? colors.brand : colors.textTertiary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }}>{t('course_shift.settings_title')}</Text>
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>
              {shiftSettings?.enabled
                ? t('course_shift.row_on', {
                  m: `${formatTime12(shiftSettings.morning.start)}–${formatTime12(shiftSettings.morning.end)}`,
                  e: `${formatTime12(shiftSettings.evening.start)}–${formatTime12(shiftSettings.evening.end)}`,
                })
                : t('course_shift.row_off')}
            </Text>
            <Icon name="back" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </Surface>
        <Surface id="teacher.courses.list">
        <FlatList showsVerticalScrollIndicator={false}
          data={list}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <CourseRow c={item} onPress={open} />}
          removeClippedSubviews initialNumToRender={8} maxToRenderPerBatch={8} windowSize={7}
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="book" title={t('teacher.courses_empty_title')} message={t('teacher.courses_empty_hint')} />}
        />
        </Surface>
        </>
      )}
    </FormScreen>
    </Surface>
  );
}
