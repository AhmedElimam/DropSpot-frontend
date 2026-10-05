import { useState } from 'react';
import { Text, Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { EmptyState } from '@/components/ui/EmptyState';
import { TimePicker } from '@/components/ui/TimePicker';
import { Button } from '@/components/ui/Button';
import { FormScreen, FormCard, Field, Chips, DayPicker, NumberInput, Banner, TimeRangeRow } from '@/components/ui/Form';
import { useTeacherCourses } from '@/hooks/useStudents';
import { useCreateSchedule } from '@/hooks/useSchedules';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Add a weekly slot to an EXISTING course (day / time / capacity). Reached from the
 * Sessions tab «+» and a course's slots list, gated by can(MANAGE_SESSIONS).
 */
export default function ScheduleNew() {
  const { t } = useTranslation();
  const { data: courses, isLoading } = useTeacherCourses();
  const create = useCreateSchedule();

  const [courseId, setCourseId] = useState<number | null>(null);
  const [day, setDay] = useState<number>(6);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [capacity, setCapacity] = useState('');

  const startValid = TIME_RE.test(start);
  const endValid = TIME_RE.test(end);
  const orderBad = startValid && endValid && end <= start;

  const submit = () => {
    if (create.isPending) return;
    // The button is always tappable (never a mystery-disabled state); on tap we tell
    // the teacher exactly what's missing instead of silently doing nothing.
    const missing: string[] = [];
    if (courseId === null) missing.push(t('teacher.schedule_need_course'));
    if (!startValid) missing.push(t('teacher.schedule_need_start'));
    if (!endValid) missing.push(t('teacher.schedule_need_end'));
    if (orderBad) missing.push(t('teacher.schedule_end_after'));
    if (missing.length) {
      Alert.alert(t('teacher.schedule_incomplete'), '• ' + missing.join('\n• '));
      return;
    }
    const cap = capacity.trim() ? Number(capacity.trim()) : undefined;
    create.mutate(
      { course_id: courseId!, day_of_week: day, start_time: start, end_time: end, capacity: cap && cap > 0 ? cap : undefined },
      {
        onSuccess: (res) => {
          const msg = t('teacher.schedule_created', { count: res.generated });
          Alert.alert(t('teacher.add_schedule_title'), res.warning ? `${msg}\n\n${res.warning}` : msg, [{ text: t('common.ok'), onPress: () => router.back() }]);
        },
        // Surface the server message — notably the schedule-conflict block.
        onError: (e: any) => Alert.alert(t('teacher.schedule_create_failed'), e?.response?.data?.message || undefined),
      },
    );
  };

  const list = courses ?? [];

  return (
    <FormScreen title={t('teacher.add_schedule_title')} subtitle={t('teacher.add_schedule_hint')} loading={isLoading}>
      {list.length === 0 ? (
        <EmptyState icon="calendar" title={t('teacher.schedule_no_courses')} message={t('teacher.add_schedule_hint')} />
      ) : (
        <>
          <FormCard icon="book" title={t('teacher.schedule_course')} required>
            <Chips options={list.map((c) => ({ key: c.id, label: c.name }))} value={courseId} onChange={setCourseId} />
          </FormCard>

          <FormCard icon="calendar" title={t('teacher.schedule_day')} required tint={colors.accent}>
            <DayPicker value={day} onChange={setDay} tint={colors.accent} />
            <Field label={t('teacher.schedule_start')} required>
              <TimeRangeRow>
                <View style={{ flex: 1 }}><TimePicker value={start || null} onChange={setStart} /></View>
                <Text style={{ fontFamily: fonts.bold, color: colors.textTertiary }}>–</Text>
                <View style={{ flex: 1 }}><TimePicker value={end || null} onChange={setEnd} invalid={orderBad} /></View>
              </TimeRangeRow>
            </Field>
            {orderBad ? <Banner tone="danger" text={t('teacher.schedule_end_after')} style={{ marginTop: spacing.md, marginBottom: 0 }} /> : null}
          </FormCard>

          <FormCard icon="children" title={t('teacher.schedule_capacity')} hint={t('teacher.schedule_capacity_ph')} tint={colors.success}>
            <NumberInput value={capacity} onChangeText={setCapacity} placeholder={t('teacher.optional')} maxLength={4} />
          </FormCard>

          <Button title={t('teacher.schedule_submit')} onPress={submit} loading={create.isPending} variant="primary" />
        </>
      )}
    </FormScreen>
  );
}
