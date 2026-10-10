import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Alert } from '@/ui/dialog';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { TimePicker, formatTime12, format12InText } from '@/components/ui/TimePicker';
import { Button } from '@/components/ui/Button';
import { FormScreen, FormCard, Field, Input, DateField, Banner, HeaderCount } from '@/components/ui/Form';
import { useOverrideOptions, useCreateOverride, useCancelOverride } from '@/hooks/useScheduleTools';
import { formatNumber } from '@/utils/format';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Temporary, auto-reverting time overrides (Ramadan hours). Shift chosen slots to a new
 * start time inside a date window; they revert by themselves when it ends.
 */
export default function ScheduleOverridesScreen() {
  const { t } = useTranslation();
  const { data, isLoading } = useOverrideOptions();
  const create = useCreateOverride();
  const cancel = useCancelOverride();

  const [label, setLabel] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  // scheduleId → new start time (empty = not included).
  const [times, setTimes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data && !start && !end) { setStart(data.suggested.start); setEnd(data.suggested.end); }
  }, [data, start, end]);

  const chosen = Object.entries(times).filter(([, v]) => TIME_RE.test(v));
  const datesValid = DATE_RE.test(start) && DATE_RE.test(end) && end >= start;
  const canSubmit = datesValid && chosen.length > 0 && !create.isPending;

  const submit = () => {
    if (!canSubmit) return;
    create.mutate(
      { label: label.trim() || undefined, start_date: start, end_date: end, items: chosen.map(([schedule_id, start_time]) => ({ schedule_id: Number(schedule_id), start_time })) },
      {
        onSuccess: (res) => Alert.alert(t('teacher.overrides_title'), t('teacher.overrides_done', { count: res.created, date: end }), [{ text: t('common.ok'), onPress: () => { setTimes({}); setLabel(''); } }]),
        onError: () => Alert.alert(t('common.error'), t('teacher.overrides_failed')),
      },
    );
  };
  const confirmCancel = (id: string) => {
    Alert.alert(t('teacher.overrides_cancel_title'), t('teacher.overrides_cancel_hint'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('teacher.overrides_cancel_confirm'), style: 'destructive', onPress: () => cancel.mutate(id) },
    ]);
  };

  return (
    <FormScreen title={t('teacher.overrides_title')} subtitle={t('teacher.overrides_sub')} loading={isLoading || !data}
      right={data && data.active.length > 0 ? <HeaderCount n={data.active.length} /> : null}>
      {data ? (
        <>
          <Banner tone="info" text={t('teacher.overrides_intro', { eid: data.suggested.eid })} />

          {data.active.length > 0 ? (
            <FormCard icon="clock" title={t('teacher.overrides_active')} tint={colors.success}>
              {data.active.map((o) => (
                <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStartWidth: 4, borderStartColor: colors.success, padding: spacing.md, marginBottom: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{o.label}{o.course_name ? ` · ${o.course_name}` : ''}</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {format12InText(o.slot_label)} ← {format12InText(o.new_time)}{o.end_date ? ` · ${t('teacher.until')} ${o.end_date}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => confirmCancel(o.id)} disabled={cancel.isPending} accessibilityRole="button" accessibilityLabel={t('teacher.overrides_cancel_confirm')}
                    style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.dangerLight, justifyContent: 'center', alignItems: 'center' }}>
                    {cancel.isPending && cancel.variables === o.id ? <ActivityIndicator size="small" color={colors.danger} /> : <Icon name="trash" size={18} color={colors.danger} />}
                  </TouchableOpacity>
                </View>
              ))}
            </FormCard>
          ) : null}

          <FormCard icon="calendar" title={t('teacher.overrides_new')} tint={colors.accent}>
            <Field label={t('teacher.overrides_label_ph')} first hint={t('form_ui.optional')}>
              <Input value={label} onChangeText={setLabel} placeholder="رمضان" maxLength={60} />
            </Field>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}><Field label={t('teacher.pause_from')}><DateField value={start} onChange={(v) => { setStart(v); if (v > end) setEnd(v); }} /></Field></View>
              <View style={{ flex: 1 }}><Field label={t('teacher.pause_to')}><DateField value={end} minIso={start} onChange={setEnd} invalid={!datesValid} /></Field></View>
            </View>
          </FormCard>

          <FormCard icon="clock" title={t('teacher.overrides_pick_slots')} required hint={chosen.length ? t('form_ui.slots_n', { n: formatNumber(chosen.length) }) : t('teacher.overrides_new_start')}>
            {data.courses.map((group, gi) => (
              <View key={group.course_name ?? `g${gi}`} style={{ marginBottom: spacing.sm }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{group.course_name}</Text>
                {group.schedules.map((s) => {
                  const included = TIME_RE.test(times[s.id] ?? '');
                  return (
                    <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: included ? colors.brandTint : colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1, borderColor: included ? colors.brand : colors.border, padding: spacing.sm, paddingStart: spacing.md, marginBottom: spacing.sm }}>
                      <Icon name={included ? 'success' : 'clock'} size={18} color={included ? colors.brand : colors.textTertiary} />
                      <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, color: included ? colors.brand : colors.textPrimary }} numberOfLines={2}>{format12InText(s.label)}</Text>
                      <View style={{ width: 132 }}>
                        <TimePicker value={times[s.id] || null} onChange={(v) => setTimes((prev) => ({ ...prev, [s.id]: v }))} placeholder={formatTime12(s.start_time)} />
                      </View>
                      {included ? (
                        <TouchableOpacity onPress={() => setTimes((prev) => { const n = { ...prev }; delete n[s.id]; return n; })} hitSlop={8} accessibilityLabel={t('form_ui.remove')}>
                          <Icon name="close" size={16} color={colors.textTertiary} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </FormCard>

          <Button title={t('teacher.overrides_apply')} onPress={submit} loading={create.isPending} disabled={!canSubmit} variant="primary" />
        </>
      ) : null}
    </FormScreen>
  );
}
