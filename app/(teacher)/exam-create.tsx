import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { TimePicker } from '@/components/ui/TimePicker';
import { getSessionCreateOptions, createOneOffSession, type SessionSlotOption } from '@/api/teacherSessions';

/** Local YYYY-MM-DD (never toISOString — that shifts by the UTC offset). */
function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function upcomingDays(count: number): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push({ iso: toIsoDate(d), label: d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' }) });
  }
  return out;
}

/**
 * Create a ONE-OFF special/exam session (normal mode — NOT the revision engine).
 * The teacher picks one of their weekly slots, a date + time, and (for an exam)
 * the max mark. On create the app jumps straight to that session's detail, where
 * the whole slot roster is listed for attendance + exam-mark entry.
 */
export default function ExamCreateScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
    onSuccess: (detail) => {
      router.replace(`/(teacher)/students/session/${detail.id}` as never);
    },
    onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.exam_create_failed')),
  });

  const submit = () => {
    if (!slotId) {
      Alert.alert(t('common.error'), t('teacher.exam_create_need_slot'));
      return;
    }
    create.mutate({
      session_schedule_id: Number(slotId),
      scheduled_at: `${dateIso} ${time}`,
      type,
      sheet_max_mark: isExam && maxMark.trim() ? Number(maxMark) : null,
      duration_minutes: duration.trim() ? Number(duration) : 60,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.exam_create_title')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.brandTint, borderRadius: radius.lg, padding: spacing.md, marginVertical: spacing.md }}>
            <Icon name="reports" size={18} color={colors.brand} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>{t('teacher.exam_create_hint')}</Text>
          </View>

          {/* Type: exam vs plain special session */}
          <FieldLabel>{t('teacher.exam_create_type')}</FieldLabel>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <Pill label={t('teacher.exam_type_exam')} active={isExam} onPress={() => setType('quiz_exam')} />
            <Pill label={t('teacher.exam_type_special')} active={!isExam} onPress={() => setType('normal_sheet')} />
          </View>

          {/* Slot picker */}
          <FieldLabel>{t('teacher.exam_create_pick_slot')}</FieldLabel>
          {isError ? (
            <TouchableOpacity onPress={() => refetch()} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.dangerLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
              <Icon name="warning" size={18} color={colors.danger} />
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: colors.dangerText }}>{t('teacher.exam_create_load_failed')}</Text>
            </TouchableOpacity>
          ) : (slots ?? []).length === 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.warningLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
              <Icon name="warning" size={18} color={colors.warning} />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>{t('teacher.exam_create_empty')}</Text>
            </View>
          ) : null}
          {(slots ?? []).map((s: SessionSlotOption) => {
            const active = slotId === s.schedule_id;
            return (
              <TouchableOpacity
                key={s.schedule_id}
                onPress={() => setSlotId(s.schedule_id)}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brandTint : colors.surface, marginBottom: spacing.sm }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: active ? colors.brand : colors.borderStrong, justifyContent: 'center', alignItems: 'center' }}>
                  {active ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand }} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: active ? colors.brand : colors.textPrimary }}>{s.course_name}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{s.day_label} · {s.time_label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Date */}
          <FieldLabel>{t('teacher.exam_create_date')}</FieldLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: spacing.sm }}>
            {days.map((d) => (
              <TouchableOpacity
                key={d.iso}
                onPress={() => setDateIso(d.iso)}
                style={{ paddingHorizontal: spacing.md, height: 40, justifyContent: 'center', borderRadius: radius.full, backgroundColor: dateIso === d.iso ? colors.brand : colors.surfaceSunken, borderWidth: 1, borderColor: dateIso === d.iso ? colors.brand : colors.border }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: dateIso === d.iso ? '#fff' : colors.textSecondary }}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Time + duration */}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>{t('teacher.exam_create_time')}</FieldLabel>
              <TimePicker value={time} onChange={setTime} />
            </View>
            <View style={{ width: 120 }}>
              <FieldLabel>{t('teacher.exam_create_duration')}</FieldLabel>
              <TextInput value={duration} onChangeText={setDuration} keyboardType="numeric" style={input} />
            </View>
          </View>

          {/* Max mark (exam only) */}
          {isExam ? (
            <>
              <FieldLabel>{t('teacher.exam_create_max')}</FieldLabel>
              <TextInput value={maxMark} onChangeText={setMaxMark} keyboardType="numeric" placeholder={t('teacher.optional')} placeholderTextColor={colors.textTertiary} style={input} />
            </>
          ) : null}

          <View style={{ marginTop: spacing.xl }}>
            <Button title={t('teacher.exam_create_submit')} onPress={submit} loading={create.isPending} disabled={!slotId} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, textAlign: 'right', marginTop: spacing.md, marginBottom: spacing.xs }}>{children}</Text>;
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flex: 1, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: radius.lg, borderWidth: 1.5, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brandTint : colors.surface }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: active ? colors.brand : colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}

const input = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const };
