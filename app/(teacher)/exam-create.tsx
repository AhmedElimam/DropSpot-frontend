import { useMemo, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Alert } from '@/ui/dialog';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { colors, spacing } from '@/theme/index';
import { Button } from '@/components/ui/Button';
import { TimePicker } from '@/components/ui/TimePicker';
import { FormScreen, FormCard, Field, Chips, DateStrip, NumberInput, OptionRow, Banner, upcomingDays } from '@/components/ui/Form';
import { getSessionCreateOptions, createOneOffSession, type SessionSlotOption } from '@/api/teacherSessions';

/**
 * Create a ONE-OFF special / exam session (normal mode — NOT the revision engine). Pick a
 * weekly slot, a date + time and (for an exam) the max mark; on create the app jumps to
 * that session's sheet, where the slot's roster is listed for attendance + marks.
 */
export default function ExamCreateScreen() {
  const { t } = useTranslation();
  const days = useMemo(() => upcomingDays(30), []);
  const { data: slots, isLoading, isError, refetch } = useQuery({ queryKey: ['session-create-options'], queryFn: getSessionCreateOptions });

  const [slotId, setSlotId] = useState<string | null>(null);
  const [type, setType] = useState<'quiz_exam' | 'normal_sheet'>('quiz_exam');
  const [dateIso, setDateIso] = useState<string>(days[0].iso);
  const [time, setTime] = useState('16:00');
  const [maxMark, setMaxMark] = useState('');
  const [duration, setDuration] = useState('60');
  const isExam = type === 'quiz_exam';

  const create = useMutation({
    mutationFn: createOneOffSession,
    onSuccess: (detail) => router.replace(`/(teacher)/sessions/${detail.id}` as never),
    onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.exam_create_failed')),
  });

  const submit = () => {
    if (!slotId) { Alert.alert(t('common.error'), t('teacher.exam_create_need_slot')); return; }
    create.mutate({
      session_schedule_id: Number(slotId),
      scheduled_at: `${dateIso} ${time}`,
      type,
      sheet_max_mark: isExam && maxMark.trim() ? Number(maxMark) : null,
      duration_minutes: duration.trim() ? Number(duration) : 60,
    });
  };

  return (
    <FormScreen title={t('teacher.exam_create_title')} subtitle={t('teacher.exam_create_hint')} loading={isLoading}>
      <FormCard icon="quiz" title={t('teacher.exam_create_type')} tint={isExam ? colors.accent : colors.brand}>
        <Chips fill tint={isExam ? colors.accent : colors.brand}
          options={[{ key: 'quiz_exam' as const, label: t('teacher.exam_type_exam'), icon: 'trophy' }, { key: 'normal_sheet' as const, label: t('teacher.exam_type_special'), icon: 'quiz' }]}
          value={type} onChange={setType} />
        {isExam ? (
          <Field label={t('teacher.exam_create_max')} hint={t('teacher.type_quiz_exam_hint')}>
            <NumberInput value={maxMark} onChangeText={setMaxMark} placeholder={t('teacher.optional')} />
          </Field>
        ) : null}
      </FormCard>

      <FormCard icon="book" title={t('teacher.exam_create_pick_slot')} required>
        {isError && !slots ? (
          <TouchableOpacity onPress={() => refetch()} activeOpacity={0.8}><Banner tone="danger" text={t('teacher.exam_create_load_failed')} style={{ marginBottom: 0 }} /></TouchableOpacity>
        ) : (slots ?? []).length === 0 ? (
          <Banner tone="warn" text={t('teacher.exam_create_empty')} style={{ marginBottom: 0 }} />
        ) : (
          (slots ?? []).map((s: SessionSlotOption) => (
            <OptionRow key={s.schedule_id} title={s.course_name ?? '—'} sub={`${s.day_label} · ${s.time_label}`} selected={slotId === s.schedule_id} onPress={() => setSlotId(s.schedule_id)} />
          ))
        )}
      </FormCard>

      <FormCard icon="calendar" title={t('teacher.exam_create_date')} required tint={colors.success}>
        <DateStrip days={days} value={dateIso} onChange={setDateIso} />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field label={t('teacher.exam_create_time')}><TimePicker value={time} onChange={setTime} /></Field>
          </View>
          <View style={{ width: 130 }}>
            <Field label={t('teacher.exam_create_duration')}><NumberInput value={duration} onChangeText={setDuration} suffix={t('form_ui.minutes')} /></Field>
          </View>
        </View>
      </FormCard>

      <Button title={t('teacher.exam_create_submit')} onPress={submit} loading={create.isPending} disabled={!slotId} />
    </FormScreen>
  );
}
