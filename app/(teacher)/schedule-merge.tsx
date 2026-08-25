import { useEffect, useMemo, useState } from 'react';
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
 * Merge same-grade COURSES (schedule-master level). The teacher picks the courses to
 * merge, then a DESTINATION course — which may be one of them (it survives) or a
 * different third course. Every source's students move into the destination; each
 * source that isn't the destination is terminated (its weekly slots retired).
 */
export default function ScheduleMergeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: courses, isLoading } = useMergeOptions();
  const merge = useMergeCourses();

  const [sources, setSources] = useState<string[]>([]);       // courses to merge
  const [destinationId, setDestinationId] = useState<string | null>(null);

  // Everything must share one grade — locked by the first selection (source or destination).
  const lockedGradeId = useMemo(() => {
    const firstSource = sources.length ? (courses ?? []).find((c) => c.id === sources[0]) : null;
    if (firstSource) return firstSource.grade_id;
    const dest = destinationId ? (courses ?? []).find((c) => c.id === destinationId) : null;
    return dest?.grade_id ?? null;
  }, [sources, destinationId, courses]);

  const sameGrade = (c: MergeCourse) => lockedGradeId == null || c.grade_id === lockedGradeId;
  const candidates = (courses ?? []).filter(sameGrade);

  // Clear a destination that no longer matches the locked grade.
  useEffect(() => {
    if (destinationId) {
      const d = (courses ?? []).find((c) => c.id === destinationId);
      if (d && lockedGradeId != null && d.grade_id !== lockedGradeId) setDestinationId(null);
    }
  }, [lockedGradeId, destinationId, courses]);

  const toggleSource = (id: string) =>
    setSources((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // Sources that will actually be terminated (everything picked except the destination).
  const realSources = sources.filter((id) => id !== destinationId);
  const destination = (courses ?? []).find((c) => c.id === destinationId) ?? null;
  const movingCount = realSources.reduce((sum, id) => sum + ((courses ?? []).find((c) => c.id === id)?.headcount ?? 0), 0);
  const canSubmit = !!destinationId && realSources.length >= 1 && !merge.isPending;

  const submit = () => {
    if (!canSubmit || !destinationId) return;
    Alert.alert(
      t('teacher.merge_confirm_title'),
      t('teacher.merge_course_confirm_multi', { count: movingCount, course: destination?.course_name ?? '', terminated: realSources.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('teacher.merge_title'),
          onPress: () =>
            merge.mutate(
              { destination_course_id: Number(destinationId), source_course_ids: sources.map(Number) },
              {
                onSuccess: (res) => {
                  const warn = res.warnings?.length ? `\n\n${res.warnings.join('\n')}` : '';
                  Alert.alert(t('teacher.merge_title'), t('teacher.merge_done_multi', { count: res.moved, terminated: res.terminated }) + warn, [
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

  const CourseRow = ({ course, mode, active, onPress }: { course: MergeCourse; mode: 'check' | 'radio'; active: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brandTint : colors.surface, marginBottom: spacing.sm }}
    >
      <View style={{
        width: 22, height: 22, borderRadius: mode === 'radio' ? 11 : 6, borderWidth: 2,
        borderColor: active ? colors.brand : colors.borderStrong, justifyContent: 'center', alignItems: 'center',
        backgroundColor: active && mode === 'check' ? colors.brand : 'transparent',
      }}>
        {active && mode === 'check' ? <Icon name="success" size={14} color="#fff" /> : null}
        {active && mode === 'radio' ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand }} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: active ? colors.brand : colors.textPrimary }}>{course.course_name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 3 }}>
          {course.slots_label ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{course.slots_label}</Text>
          ) : null}
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('teacher.students_count', { count: course.headcount })}</Text>
        </View>
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

          {/* Courses to merge (multi-select, same grade) */}
          <Text style={label}>{t('teacher.merge_sources')}</Text>
          {candidates.map((c) => (
            <CourseRow key={c.id} course={c} mode="check" active={sources.includes(c.id)} onPress={() => toggleSource(c.id)} />
          ))}

          {/* Destination (single-select) — one of the merged courses OR a different one */}
          {sources.length >= 1 ? (
            <>
              <Text style={label}>{t('teacher.merge_destination')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('teacher.merge_pick_destination')}</Text>
              {candidates.map((c) => (
                <CourseRow key={`d-${c.id}`} course={c} mode="radio" active={destinationId === c.id} onPress={() => setDestinationId(c.id)} />
              ))}
              {destinationId ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.infoLight, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.xs }}>
                  <Icon name="info" size={18} color={colors.infoText} outline />
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.infoText }}>
                    {sources.includes(destinationId) ? t('teacher.merge_destination_hint_survives') : t('teacher.merge_destination_hint_new')}
                  </Text>
                </View>
              ) : null}
            </>
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
