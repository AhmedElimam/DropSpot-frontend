import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { TimePicker } from '@/components/ui/TimePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMergeOptions, useMergeCourses } from '@/hooks/useScheduleTools';
import type { MergeCourse } from '@/api/scheduleTools';

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
type NewSlot = { day: number; start: string; end: string };

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
  const [destinationId, setDestinationId] = useState<string | null>(null); // a course id, or 'new'
  const [newName, setNewName] = useState('');
  const [newSlots, setNewSlots] = useState<NewSlot[]>([{ day: 0, start: '16:00', end: '17:00' }]);
  const isNew = destinationId === 'new';

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
  const slotsValid = newSlots.length >= 1 && newSlots.every((s) => !!s.start && !!s.end);
  const canSubmit = (isNew
    ? newName.trim().length > 0 && slotsValid && realSources.length >= 1
    : !!destinationId && realSources.length >= 1) && !merge.isPending;

  const setSlot = (i: number, patch: Partial<NewSlot>) => setNewSlots((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addSlot = () => setNewSlots((s) => [...s, { day: 0, start: '16:00', end: '17:00' }]);
  const removeSlot = (i: number) => setNewSlots((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : s));

  const submit = () => {
    if (!canSubmit) return;
    const destName = isNew ? newName.trim() : (destination?.course_name ?? '');
    const payload = isNew
      ? { new_course_name: newName.trim(), new_course_slots: newSlots.map((s) => ({ day_of_week: s.day, start_time: s.start, end_time: s.end })), source_course_ids: sources.map(Number) }
      : { destination_course_id: Number(destinationId), source_course_ids: sources.map(Number) };
    Alert.alert(
      t('teacher.merge_confirm_title'),
      t('teacher.merge_course_confirm_multi', { count: movingCount, course: destName, terminated: realSources.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('teacher.merge_title'),
          onPress: () =>
            merge.mutate(
              payload,
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

              {/* Create a brand-new course on the spot to move both into. */}
              <TouchableOpacity
                onPress={() => setDestinationId('new')}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: isNew ? colors.brand : colors.border, backgroundColor: isNew ? colors.brandTint : colors.surface, marginBottom: spacing.sm }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isNew ? colors.brand : colors.borderStrong, justifyContent: 'center', alignItems: 'center' }}>
                  {isNew ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand }} /> : null}
                </View>
                <Icon name="add" size={18} color={isNew ? colors.brand : colors.textSecondary} />
                <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: isNew ? colors.brand : colors.textPrimary }}>{t('teacher.merge_new_course')}</Text>
              </TouchableOpacity>

              {isNew ? (
                <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('teacher.merge_new_course_name')}</Text>
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder={t('teacher.merge_new_course_name_ph')}
                    placeholderTextColor={colors.textTertiary}
                    maxLength={120}
                    style={{ backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 46, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.md }}
                  />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('teacher.merge_new_course_slots')}</Text>
                  {newSlots.map((s, i) => (
                    <View key={i} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm }}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
                        {DAYS.map((d, di) => (
                          <TouchableOpacity key={di} onPress={() => setSlot(i, { day: di })} activeOpacity={0.8}
                            style={{ paddingHorizontal: spacing.sm, height: 30, justifyContent: 'center', borderRadius: radius.full, borderWidth: 1.5, borderColor: s.day === di ? colors.brand : colors.border, backgroundColor: s.day === di ? colors.brandTint : colors.surfaceSunken }}>
                            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: s.day === di ? colors.brand : colors.textSecondary }}>{d}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <View style={{ flex: 1 }}><TimePicker value={s.start} onChange={(v) => setSlot(i, { start: v })} /></View>
                        <Text style={{ fontFamily: fonts.regular, color: colors.textTertiary }}>–</Text>
                        <View style={{ flex: 1 }}><TimePicker value={s.end} onChange={(v) => setSlot(i, { end: v })} /></View>
                        {newSlots.length > 1 ? (
                          <TouchableOpacity onPress={() => removeSlot(i)} hitSlop={8}><Icon name="trash" size={18} color={colors.danger} /></TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity onPress={addSlot} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs }}>
                    <Icon name="add" size={16} color={colors.brand} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.merge_add_slot')}</Text>
                  </TouchableOpacity>
                </View>
              ) : destinationId ? (
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
