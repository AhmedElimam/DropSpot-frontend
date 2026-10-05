import { useState } from 'react';
import { View, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '@/theme/index';
import { Button } from '@/components/ui/Button';
import { FormScreen, FormCard, Field, Chips, DateField, Banner, toIsoDate } from '@/components/ui/Form';
import { usePauseSessions } from '@/hooks/useTeacherSessionHistory';
import { formatNumber, formatDayDate } from '@/utils/format';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function plusDays(n: number): string {
  const d = new Date(); d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

/**
 * Pause a date RANGE — bulk-cancels every not-yet-completed session between two dates
 * (inclusive), scoped to the teacher's courses. Dates come from a picker, not typed.
 */
export default function PausePeriodScreen() {
  const { t } = useTranslation();
  const pause = usePauseSessions();

  const [from, setFrom] = useState(toIsoDate(new Date()));
  const [to, setTo] = useState(toIsoDate(new Date()));
  const [preset, setPreset] = useState<number | null>(0);

  const fromValid = DATE_RE.test(from) && !Number.isNaN(Date.parse(from));
  const toValid = DATE_RE.test(to) && !Number.isNaN(Date.parse(to));
  const orderValid = !fromValid || !toValid || to >= from;
  const canSubmit = fromValid && toValid && orderValid && !pause.isPending;
  const dayCount = fromValid && toValid && orderValid ? Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1 : 0;

  const applyPreset = (days: number) => { setPreset(days); setFrom(toIsoDate(new Date())); setTo(plusDays(days)); };

  const submit = () => {
    if (!canSubmit) return;
    Alert.alert(t('teacher.pause_confirm_title'), t('teacher.pause_confirm_hint', { from, to }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('teacher.pause_period'), style: 'destructive',
        onPress: () => pause.mutate({ from, to }, {
          onSuccess: (res) => Alert.alert(t('teacher.pause_period'), t('teacher.pause_done', { count: res.cancelled }), [{ text: t('common.ok'), onPress: () => router.back() }]),
          onError: () => Alert.alert(t('common.error'), t('teacher.pause_failed')),
        }),
      },
    ]);
  };

  const fmt = (iso: string) => formatDayDate(new Date(`${iso}T00:00:00`));

  return (
    <FormScreen title={t('teacher.pause_period')} subtitle={t('teacher.pause_sub')}>
      <Banner tone="warn" text={t('teacher.pause_intro')} />

      <FormCard icon="clock" title={t('teacher.pause_period')} tint={colors.warning}>
        <Chips fill tint={colors.warning}
          options={[{ key: 0, label: t('teacher.preset_today') }, { key: 6, label: t('teacher.preset_week') }, { key: 13, label: t('teacher.preset_two_weeks') }]}
          value={preset} onChange={applyPreset} />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field label={t('teacher.pause_from')}><DateField value={from} onChange={(v) => { setFrom(v); setPreset(null); if (v > to) setTo(v); }} /></Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('teacher.pause_to')}><DateField value={to} minIso={from} onChange={(v) => { setTo(v); setPreset(null); }} invalid={!orderValid} /></Field>
          </View>
        </View>
        {!orderValid ? (
          <Banner tone="danger" text={t('teacher.pause_order_error')} style={{ marginTop: spacing.md, marginBottom: 0 }} />
        ) : dayCount > 0 ? (
          <Banner tone="info" icon="calendar" text={`${t('form_ui.range', { from: fmt(from), to: fmt(to) })} · ${t('form_ui.days_count', { n: formatNumber(dayCount) })}`} style={{ marginTop: spacing.md, marginBottom: 0 }} />
        ) : null}
      </FormCard>

      <Button title={t('teacher.pause_period')} onPress={submit} loading={pause.isPending} disabled={!canSubmit} variant="destructive" />
    </FormScreen>
  );
}
