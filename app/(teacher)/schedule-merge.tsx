import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMergeOptions, useMergeCourses } from '@/hooks/useScheduleTools';
import type { MergeCourse } from '@/api/scheduleTools';

/**
 * Merge two same-grade COURSES into one (schedule-master level). The survivor course
 * receives ALL the retiring course's students — they follow the survivor's weekly
 * schedule — and the retiring course's sessions are stopped. Course-level, so a
 * course that meets several weekdays is ONE pick, not one per day.
 */
export default function ScheduleMergeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: courses, isLoading } = useMergeOptions();
  const merge = useMergeCourses();

  const [survivorId, setSurvivorId] = useState<string | null>(null);
  const [retiringId, setRetiringId] = useState<string | null>(null);

  const survivor = courses?.find((c) => c.id === survivorId) ?? null;
  // Retiring candidates: same grade as survivor, excluding the survivor itself.
  const retiringCandidates = useMemo(
    () => (courses ?? []).filter((c) => survivor && c.grade_id === survivor.grade_id && c.id !== survivor.id),
    [courses, survivor],
  );

  const canSubmit = !!survivorId && !!retiringId && survivorId !== retiringId && !merge.isPending;

  const submit = () => {
    if (!canSubmit || !survivorId || !retiringId) return;
    const retiring = courses?.find((c) => c.id === retiringId);
    Alert.alert(
      t('teacher.merge_confirm_title'),
      t('teacher.merge_course_confirm_hint', { count: retiring?.headcount ?? 0, course: survivor?.course_name ?? '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('teacher.merge_title'),
          onPress: () =>
            merge.mutate(
              { survivor_course_id: Number(survivorId), retiring_course_id: Number(retiringId) },
              {
                onSuccess: (res) => {
                  const warn = res.warnings?.length ? `\n\n${res.warnings.join('\n')}` : '';
                  Alert.alert(t('teacher.merge_title'), t('teacher.merge_done', { count: res.moved }) + warn, [
                    { text: t('common.ok'), onPress: () => router.back() },
                  ]);
                },
                onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.merge_failed')),
              },
            ),
        },
      ],
    );
  };

  const CourseRow = ({ course, active, onPress }: { course: MergeCourse; active: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brandTint : colors.surface, marginBottom: spacing.sm }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: active ? colors.brand : colors.textPrimary }}>{course.course_name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 3 }}>
        {course.slots_label ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{course.slots_label}</Text>
        ) : null}
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('teacher.students_count', { count: course.headcount })}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.merge_title')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (courses ?? []).length < 2 ? (
        <EmptyState icon="calendar" title={t('teacher.merge_need_two')} message={t('teacher.merge_need_two_hint')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.warningLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
            <Icon name="warning" size={18} color={colors.warning} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('teacher.merge_course_intro')}</Text>
          </View>

          {/* Survivor course (the one that stays) */}
          <Text style={label}>{t('teacher.merge_survivor_course')}</Text>
          {(courses ?? []).map((c) => (
            <CourseRow key={c.id} course={c} active={c.id === survivorId} onPress={() => { setSurvivorId(c.id); if (retiringId === c.id) setRetiringId(null); }} />
          ))}

          {/* Retiring course (same grade) */}
          {survivor ? (
            <>
              <Text style={label}>{t('teacher.merge_retiring_course')}</Text>
              {retiringCandidates.length === 0 ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('teacher.merge_no_same_grade')}</Text>
              ) : (
                retiringCandidates.map((c) => (
                  <CourseRow key={c.id} course={c} active={c.id === retiringId} onPress={() => setRetiringId(c.id)} />
                ))
              )}
            </>
          ) : null}

          {survivorId && retiringId ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.infoLight, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md }}>
              <Icon name="info" size={18} color={colors.infoText} outline />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.infoText }}>{t('teacher.merge_course_result_hint')}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: spacing.xl }}>
            <Button title={t('teacher.merge_title')} onPress={submit} loading={merge.isPending} disabled={!canSubmit} variant="primary" />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const label = { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm } as const;
