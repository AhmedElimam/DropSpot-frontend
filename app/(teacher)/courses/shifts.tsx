import { useState } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { FormScreen, FormCard, Field, SwitchRow, Banner, TimeRangeRow } from '@/components/ui/Form';
import { TimePicker } from '@/components/ui/TimePicker';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/ui/dialog';
import { saveShiftSettings } from '@/api/courses';
import { useShiftSettingsStore } from '@/stores/shiftSettingsStore';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { formatNumber } from '@/utils/format';
import { Surface } from '@/ui/surfaces';

const DEFAULTS = { morning: { start: '07:00', end: '14:00' }, evening: { start: '14:00', end: '23:00' } };

/**
 * «الفترات» (founder 2026-11-07): switch morning / evening shifts on and set their hours. Every
 * course then files itself by its groups' start times — all in the morning hours → «صباحي», all
 * in the evening hours → «مسائي», groups in both (or outside both) → «بدون». Teacher only.
 */
export default function ShiftSettingsScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const saved = useShiftSettingsStore((s) => s.settings);
  const [enabled, setEnabled] = useState(saved?.enabled ?? false);
  const [morning, setMorning] = useState(saved?.morning ?? DEFAULTS.morning);
  const [evening, setEvening] = useState(saved?.evening ?? DEFAULTS.evening);

  const sameEnds = morning.start === morning.end || evening.start === evening.end;
  const save = useMutation({
    mutationFn: () => saveShiftSettings({
      enabled,
      ...(enabled ? { morning_start: morning.start, morning_end: morning.end, evening_start: evening.start, evening_end: evening.end } : {}),
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['teacher-courses'] });
      Alert.alert(t('course_shift.saved_title'), res.settings.enabled
        ? t('course_shift.saved_on', { morning: formatNumber(res.counts.morning), evening: formatNumber(res.counts.evening) })
        : t('course_shift.saved_off'), [{ text: t('common.ok'), onPress: () => router.back() }]);
    },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });

  return (
    <Surface id="screen.teacher.course_shifts" screen>
    <FormScreen title={t('course_shift.settings_title')} subtitle={t('course_shift.settings_sub')}>
      <FormCard icon="morning" title={t('course_shift.settings_title')}>
        <SwitchRow first title={t('course_shift.switch')} hint={t('course_shift.switch_hint')} value={enabled} onChange={setEnabled} />
        {enabled ? (
          <>
            <Field label={t('course_shift.morning_hours')}>
              <TimeRangeRow>
                <View style={{ flex: 1 }}><TimePicker value={morning.start} onChange={(v) => setMorning((m) => ({ ...m, start: v }))} /></View>
                <Text style={{ fontFamily: fonts.bold, color: colors.textTertiary }}>–</Text>
                <View style={{ flex: 1 }}><TimePicker value={morning.end} onChange={(v) => setMorning((m) => ({ ...m, end: v }))} invalid={morning.start === morning.end} /></View>
              </TimeRangeRow>
            </Field>
            <Field label={t('course_shift.evening_hours')}>
              <TimeRangeRow>
                <View style={{ flex: 1 }}><TimePicker value={evening.start} onChange={(v) => setEvening((m) => ({ ...m, start: v }))} /></View>
                <Text style={{ fontFamily: fonts.bold, color: colors.textTertiary }}>–</Text>
                <View style={{ flex: 1 }}><TimePicker value={evening.end} onChange={(v) => setEvening((m) => ({ ...m, end: v }))} invalid={evening.start === evening.end} /></View>
              </TimeRangeRow>
            </Field>
          </>
        ) : null}
      </FormCard>

      <Banner tone="info" icon="info" text={t('course_shift.how_it_works')} style={{ marginBottom: spacing.lg }} />

      <Button title={t('common.save')} onPress={() => save.mutate()} loading={save.isPending} disabled={enabled && sameEnds} />
    </FormScreen>
    </Surface>
  );
}
