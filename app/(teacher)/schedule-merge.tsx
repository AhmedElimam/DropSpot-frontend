import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { TimePicker, format12InText } from '@/components/ui/TimePicker';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMergeOptions, useMergeSchedules } from '@/hooks/useScheduleTools';
import type { MergeSlot, MergeCustomSlot } from '@/api/scheduleTools';

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

type TimeChoice = 'survivor' | 'retiring' | 'custom';

/**
 * Merge two same-grade slots into one (consolidate groups, retire the other) —
 * parity with the web /schedule-merges/create. The survivor receives the retiring
 * slot's students; the resulting time can keep either slot's time or become one or
 * more brand-new master days.
 */
export default function ScheduleMergeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: slots, isLoading } = useMergeOptions();
  const merge = useMergeSchedules();

  const [survivorId, setSurvivorId] = useState<string | null>(null);
  const [retiringId, setRetiringId] = useState<string | null>(null);
  const [choice, setChoice] = useState<TimeChoice>('survivor');
  const [custom, setCustom] = useState<MergeCustomSlot[]>([{ day_of_week: 0, start_time: '16:00', end_time: '18:00' }]);

  const survivor = slots?.find((s) => s.id === survivorId) ?? null;
  // Retiring candidates: same grade as survivor, excluding the survivor itself.
  const retiringCandidates = useMemo(
    () => (slots ?? []).filter((s) => survivor && s.grade_id === survivor.grade_id && s.id !== survivor.id),
    [slots, survivor],
  );

  const customValid = custom.every((c) => TIME_RE.test(c.start_time) && TIME_RE.test(c.end_time) && c.end_time > c.start_time);
  const canSubmit =
    !!survivorId && !!retiringId && survivorId !== retiringId && (choice !== 'custom' || (custom.length > 0 && customValid)) && !merge.isPending;

  const addCustomDay = () => setCustom((c) => [...c, { day_of_week: 0, start_time: '16:00', end_time: '18:00' }]);
  const removeCustomDay = (i: number) => setCustom((c) => (c.length > 1 ? c.filter((_, idx) => idx !== i) : c));
  const setCustomField = (i: number, patch: Partial<MergeCustomSlot>) =>
    setCustom((c) => c.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const submit = () => {
    if (!canSubmit || !survivorId || !retiringId) return;
    const retiring = slots?.find((s) => s.id === retiringId);
    Alert.alert(
      t('teacher.merge_confirm_title'),
      t('teacher.merge_confirm_hint', { count: retiring?.headcount ?? 0 }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('teacher.merge_title'),
          onPress: () =>
            merge.mutate(
              {
                survivor_id: Number(survivorId),
                retiring_id: Number(retiringId),
                time_choice: choice,
                slots: choice === 'custom' ? custom : undefined,
              },
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

  const SlotRow = ({ slot, active, onPress }: { slot: MergeSlot; active: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brandTint : colors.surface, marginBottom: spacing.sm }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{format12InText(slot.label)}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('teacher.students_count', { count: slot.headcount })}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.merge_title')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (slots ?? []).length < 2 ? (
        <EmptyState icon="calendar" title={t('teacher.merge_need_two')} message={t('teacher.merge_need_two_hint')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.warningLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
            <Icon name="warning" size={18} color={colors.warning} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('teacher.merge_intro')}</Text>
          </View>

          {/* Survivor */}
          <Text style={label}>{t('teacher.merge_survivor')}</Text>
          {(slots ?? []).map((s) => (
            <SlotRow key={s.id} slot={s} active={s.id === survivorId} onPress={() => { setSurvivorId(s.id); if (retiringId === s.id) setRetiringId(null); }} />
          ))}

          {/* Retiring (same grade) */}
          {survivor ? (
            <>
              <Text style={label}>{t('teacher.merge_retiring')}</Text>
              {retiringCandidates.length === 0 ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('teacher.merge_no_same_grade')}</Text>
              ) : (
                retiringCandidates.map((s) => (
                  <SlotRow key={s.id} slot={s} active={s.id === retiringId} onPress={() => setRetiringId(s.id)} />
                ))
              )}
            </>
          ) : null}

          {/* Resulting time */}
          {survivorId && retiringId ? (
            <>
              <Text style={label}>{t('teacher.merge_result_time')}</Text>
              {(['survivor', 'retiring', 'custom'] as TimeChoice[]).map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setChoice(c)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: choice === c ? colors.brand : colors.border, justifyContent: 'center', alignItems: 'center' }}>
                    {choice === c ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand }} /> : null}
                  </View>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}>
                    {c === 'survivor' ? t('teacher.merge_keep_survivor') : c === 'retiring' ? t('teacher.merge_keep_retiring') : t('teacher.merge_custom')}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Custom multi-day builder */}
              {choice === 'custom' ? (
                <View style={{ marginTop: spacing.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
                  {custom.map((row, i) => (
                    <View key={i} style={{ marginBottom: spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{t('teacher.day')} {i + 1}</Text>
                        {custom.length > 1 ? (
                          <TouchableOpacity onPress={() => removeCustomDay(i)}><Icon name="trash" size={16} color={colors.danger} /></TouchableOpacity>
                        ) : null}
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 6 }}>
                        {DAYS_AR.map((d, di) => (
                          <TouchableOpacity
                            key={di}
                            onPress={() => setCustomField(i, { day_of_week: di })}
                            style={{ paddingHorizontal: spacing.md, height: 36, justifyContent: 'center', borderRadius: radius.full, backgroundColor: row.day_of_week === di ? colors.brand : colors.surface, borderWidth: 1, borderColor: row.day_of_week === di ? colors.brand : colors.border }}
                          >
                            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: row.day_of_week === di ? '#fff' : colors.textSecondary }}>{d}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 6 }}>
                        <TimeField value={row.start_time} onChange={(v) => setCustomField(i, { start_time: v })} placeholder="16:00" />
                        <TimeField value={row.end_time} onChange={(v) => setCustomField(i, { end_time: v })} placeholder="18:00" />
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity onPress={addCustomDay} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 40, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brand }}>
                    <Icon name="add" size={16} color={colors.brand} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.add_day')}</Text>
                  </TouchableOpacity>
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

function TimeField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  // App-wide 12-hour time picker (stores 24h HH:mm for the backend). No free text.
  return (
    <View style={{ flex: 1 }}>
      <TimePicker value={value || null} onChange={onChange} placeholder={placeholder} invalid={!!value && !TIME_RE.test(value)} />
    </View>
  );
}

const label = { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm } as const;
