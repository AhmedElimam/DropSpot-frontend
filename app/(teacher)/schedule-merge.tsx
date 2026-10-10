import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Alert } from '@/ui/dialog';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { TimePicker } from '@/components/ui/TimePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormScreen, FormCard, Field, Input, OptionRow, DayPicker, Banner, TimeRangeRow } from '@/components/ui/Form';
import { useMergeOptions, useMergeCourses } from '@/hooks/useScheduleTools';
import { formatNumber } from '@/utils/format';
import type { MergeCourse } from '@/api/scheduleTools';

type NewSlot = { day: number; start: string; end: string };

/**
 * Merge same-grade COURSES (schedule-master level). Pick the courses to merge, then a
 * DESTINATION — one of them (it survives) or a brand-new course. Every source's students
 * move into the destination; each source that isn't the destination is terminated.
 */
export default function ScheduleMergeScreen() {
  const { t } = useTranslation();
  const { data: courses, isLoading } = useMergeOptions();
  const merge = useMergeCourses();

  const [sources, setSources] = useState<string[]>([]);
  const [destinationId, setDestinationId] = useState<string | null>(null); // a course id, or 'new'
  const [newName, setNewName] = useState('');
  const [newSlots, setNewSlots] = useState<NewSlot[]>([{ day: 6, start: '16:00', end: '17:00' }]);
  const isNew = destinationId === 'new';

  // Everything must share one grade — locked by the first selection (source or destination).
  const lockedGradeId = useMemo(() => {
    const firstSource = sources.length ? (courses ?? []).find((c) => c.id === sources[0]) : null;
    if (firstSource) return firstSource.grade_id;
    const dest = destinationId ? (courses ?? []).find((c) => c.id === destinationId) : null;
    return dest?.grade_id ?? null;
  }, [sources, destinationId, courses]);
  const candidates = (courses ?? []).filter((c) => lockedGradeId == null || c.grade_id === lockedGradeId);

  // Clear a destination that no longer matches the locked grade.
  useEffect(() => {
    if (destinationId) {
      const d = (courses ?? []).find((c) => c.id === destinationId);
      if (d && lockedGradeId != null && d.grade_id !== lockedGradeId) setDestinationId(null);
    }
  }, [lockedGradeId, destinationId, courses]);

  const toggleSource = (id: string) => setSources((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const realSources = sources.filter((id) => id !== destinationId);
  const destination = (courses ?? []).find((c) => c.id === destinationId) ?? null;
  const movingCount = realSources.reduce((sum, id) => sum + ((courses ?? []).find((c) => c.id === id)?.headcount ?? 0), 0);
  const slotsValid = newSlots.length >= 1 && newSlots.every((s) => !!s.start && !!s.end);
  const canSubmit = (isNew ? newName.trim().length > 0 && slotsValid && realSources.length >= 1 : !!destinationId && realSources.length >= 1) && !merge.isPending;

  const setSlot = (i: number, patch: Partial<NewSlot>) => setNewSlots((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addSlot = () => setNewSlots((s) => [...s, { day: 6, start: '16:00', end: '17:00' }]);
  const removeSlot = (i: number) => setNewSlots((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : s));

  const submit = () => {
    if (!canSubmit) return;
    const destName = isNew ? newName.trim() : (destination?.course_name ?? '');
    const payload = isNew
      ? { new_course_name: newName.trim(), new_course_slots: newSlots.map((s) => ({ day_of_week: s.day, start_time: s.start, end_time: s.end })), source_course_ids: sources.map(Number) }
      : { destination_course_id: Number(destinationId), source_course_ids: sources.map(Number) };
    Alert.alert(t('teacher.merge_confirm_title'), t('teacher.merge_course_confirm_multi', { count: movingCount, course: destName, terminated: realSources.length }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('teacher.merge_title'),
        onPress: () => merge.mutate(payload, {
          onSuccess: (res) => {
            const warn = res.warnings?.length ? `\n\n${res.warnings.join('\n')}` : '';
            Alert.alert(t('teacher.merge_title'), t('teacher.merge_done_multi', { count: res.moved, terminated: res.terminated }) + warn, [{ text: t('common.ok'), onPress: () => router.back() }]);
          },
          onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.merge_failed')),
        }),
      },
    ]);
  };

  const sub = (c: MergeCourse) => [c.slots_label, t('form_ui.students_n', { n: formatNumber(c.headcount) })].filter(Boolean).join(' · ');

  return (
    <FormScreen title={t('teacher.merge_title')} subtitle={t('teacher.merge_sub')} loading={isLoading}>
      {(courses ?? []).length < 2 ? (
        <EmptyState icon="calendar" title={t('teacher.merge_need_two')} message={t('teacher.merge_need_two_hint')} />
      ) : (
        <>
          <Banner tone="warn" text={t('teacher.merge_course_intro')} />

          <FormCard icon="book" title={t('teacher.merge_sources')} required hint={sources.length ? t('form_ui.students_n', { n: formatNumber(sources.reduce((n, id) => n + ((courses ?? []).find((c) => c.id === id)?.headcount ?? 0), 0)) }) : undefined}>
            {candidates.map((c) => <OptionRow key={c.id} mode="check" title={c.course_name ?? '—'} sub={sub(c)} selected={sources.includes(c.id)} onPress={() => toggleSource(c.id)} />)}
          </FormCard>

          {sources.length >= 1 ? (
            <FormCard icon="transfer" title={t('teacher.merge_destination')} required hint={t('teacher.merge_pick_destination')} tint={colors.success}>
              {candidates.map((c) => <OptionRow key={`d-${c.id}`} title={c.course_name ?? '—'} sub={sub(c)} selected={destinationId === c.id} onPress={() => setDestinationId(c.id)} />)}
              <OptionRow title={t('teacher.merge_new_course')} selected={isNew} onPress={() => setDestinationId('new')} leading={<Icon name="add" size={18} color={isNew ? colors.brand : colors.textSecondary} />} />

              {isNew ? (
                <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
                  <Field label={t('teacher.merge_new_course_name')} required first>
                    <Input value={newName} onChangeText={setNewName} placeholder={t('teacher.merge_new_course_name_ph')} maxLength={120} style={{ backgroundColor: colors.surface }} />
                  </Field>
                  <Field label={t('teacher.merge_new_course_slots')} required>
                    {newSlots.map((s, i) => (
                      <View key={i} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.sm }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary }}>{t('form_ui.slot_n', { n: formatNumber(i + 1) })}</Text>
                          {newSlots.length > 1 ? (
                            <TouchableOpacity onPress={() => removeSlot(i)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Icon name="trash" size={14} color={colors.danger} />
                              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.danger }}>{t('form_ui.remove')}</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                        <DayPicker value={s.day} onChange={(d) => setSlot(i, { day: d })} />
                        <View style={{ marginTop: spacing.sm }}>
                          <TimeRangeRow>
                            <View style={{ flex: 1 }}><TimePicker value={s.start} onChange={(v) => setSlot(i, { start: v })} /></View>
                            <Text style={{ fontFamily: fonts.bold, color: colors.textTertiary }}>–</Text>
                            <View style={{ flex: 1 }}><TimePicker value={s.end} onChange={(v) => setSlot(i, { end: v })} /></View>
                          </TimeRangeRow>
                        </View>
                      </View>
                    ))}
                    <TouchableOpacity onPress={addSlot} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.brand, backgroundColor: colors.brandTint }}>
                      <Icon name="add" size={16} color={colors.brand} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.merge_add_slot')}</Text>
                    </TouchableOpacity>
                  </Field>
                </View>
              ) : destinationId ? (
                <Banner tone="info" text={t(sources.includes(destinationId) ? 'teacher.merge_destination_hint_survives' : 'teacher.merge_destination_hint_new')} style={{ marginBottom: 0 }} />
              ) : null}
            </FormCard>
          ) : null}

          <Button title={t('teacher.merge_title')} onPress={submit} loading={merge.isPending} disabled={!canSubmit} variant="primary" />
        </>
      )}
    </FormScreen>
  );
}
