import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useOverrideOptions, useCreateOverride, useCancelOverride } from '@/hooks/useScheduleTools';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Temporary, auto-reverting time overrides (Ramadan Hours) — parity with the web
 * /schedule-overrides/create. Shift selected slots to a new start time within a
 * date window; they revert automatically after it ends. Cancel any active one.
 */
export default function ScheduleOverridesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useOverrideOptions();
  const create = useCreateOverride();
  const cancel = useCancelOverride();

  const [label, setLabel] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  // scheduleId → new start time (empty = not included).
  const [times, setTimes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data && !start && !end) {
      setStart(data.suggested.start);
      setEnd(data.suggested.end);
    }
  }, [data, start, end]);

  const chosen = Object.entries(times).filter(([, v]) => TIME_RE.test(v));
  const datesValid = DATE_RE.test(start) && DATE_RE.test(end) && end >= start;
  const canSubmit = datesValid && chosen.length > 0 && !create.isPending;

  const submit = () => {
    if (!canSubmit) return;
    create.mutate(
      {
        label: label.trim() || undefined,
        start_date: start,
        end_date: end,
        items: chosen.map(([schedule_id, start_time]) => ({ schedule_id: Number(schedule_id), start_time })),
      },
      {
        onSuccess: (res) =>
          Alert.alert(t('teacher.overrides_title'), t('teacher.overrides_done', { count: res.created, date: end }), [
            { text: t('common.ok'), onPress: () => { setTimes({}); setLabel(''); } },
          ]),
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
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.overrides_title')}</Text>
      </View>

      {isLoading || !data ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.brandTint, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
            <Icon name="info" size={18} color={colors.brand} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('teacher.overrides_intro', { eid: data.suggested.eid })}</Text>
          </View>

          {/* Active overrides */}
          {data.active.length > 0 ? (
            <>
              <Text style={label_}>{t('teacher.overrides_active')}</Text>
              {data.active.map((o) => (
                <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{o.label} · {o.course_name ?? ''}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{o.slot_label} → {o.new_time}{o.end_date ? ` · ${t('teacher.until')} ${o.end_date}` : ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => confirmCancel(o.id)} disabled={cancel.isPending} style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.dangerLight, justifyContent: 'center', alignItems: 'center' }}>
                    <Icon name="trash" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ) : null}

          {/* New override */}
          <Text style={label_}>{t('teacher.overrides_new')}</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={t('teacher.overrides_label_ph')}
            placeholderTextColor={colors.textTertiary}
            style={inputStyle}
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{t('teacher.pause_from')}</Text>
              <TextInput value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} autoCapitalize="none" style={inputStyle} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{t('teacher.pause_to')}</Text>
              <TextInput value={end} onChangeText={setEnd} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} autoCapitalize="none" style={inputStyle} />
            </View>
          </View>

          {/* Slot picker with per-slot new time */}
          <Text style={label_}>{t('teacher.overrides_pick_slots')}</Text>
          {data.courses.map((group) => (
            <View key={group.course_name ?? Math.random().toString()} style={{ marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{group.course_name}</Text>
              {group.schedules.map((s) => {
                const included = TIME_RE.test(times[s.id] ?? '');
                return (
                  <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: included ? colors.brandTint : colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: included ? colors.brand : colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{s.label}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>{t('teacher.overrides_new_start')}</Text>
                    </View>
                    <TextInput
                      value={times[s.id] ?? ''}
                      onChangeText={(v) => setTimes((prev) => ({ ...prev, [s.id]: v }))}
                      placeholder={s.start_time}
                      placeholderTextColor={colors.textTertiary}
                      style={{ width: 84, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, height: 42, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'center' }}
                    />
                  </View>
                );
              })}
            </View>
          ))}

          <View style={{ marginTop: spacing.md }}>
            <Button title={t('teacher.overrides_apply')} onPress={submit} loading={create.isPending} disabled={!canSubmit} variant="primary" />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const label_ = { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm } as const;
const inputStyle = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const };
