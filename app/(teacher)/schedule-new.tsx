import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { TimePicker } from '@/components/ui/TimePicker';
import { useTeacherCourses } from '@/hooks/useStudents';
import { useCreateSchedule } from '@/hooks/useSchedules';

// 0 = Sunday … 6 = Saturday — matches the backend day_of_week.
const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Add a weekly schedule slot to an EXISTING course (day / time / capacity).
 * Reached from the "الحصص" segment of the students tab, gated there by
 * can(MANAGE_SESSIONS). Course creation stays on the web dashboard.
 */
export default function ScheduleNew() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: courses, isLoading } = useTeacherCourses();
  const create = useCreateSchedule();

  const [courseId, setCourseId] = useState<number | null>(null);
  const [day, setDay] = useState<number>(0);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [capacity, setCapacity] = useState('');

  const startValid = TIME_RE.test(start);
  const endValid = TIME_RE.test(end);
  const orderValid = !startValid || !endValid || end > start;

  const submit = () => {
    if (create.isPending) return;
    // The button is always tappable (never a mystery-disabled state); on tap we tell
    // the teacher exactly what's missing instead of silently doing nothing.
    const missing: string[] = [];
    if (courseId === null) missing.push(t('teacher.schedule_need_course'));
    if (!startValid) missing.push(t('teacher.schedule_need_start'));
    if (!endValid) missing.push(t('teacher.schedule_need_end'));
    if (startValid && endValid && end <= start) missing.push(t('teacher.schedule_end_after'));
    if (missing.length) {
      Alert.alert(t('teacher.schedule_incomplete'), '• ' + missing.join('\n• '));
      return;
    }
    const cap = capacity.trim() ? Number(capacity.trim()) : undefined;
    create.mutate(
      {
        course_id: courseId!, // guaranteed non-null: validation above returns if missing
        day_of_week: day,
        start_time: start,
        end_time: end,
        capacity: cap && cap > 0 ? cap : undefined,
      },
      {
        onSuccess: (res) => {
          const msg = t('teacher.schedule_created', { count: res.generated });
          Alert.alert(
            t('teacher.add_schedule_title'),
            res.warning ? `${msg}\n\n${res.warning}` : msg,
            [{ text: 'حسنًا', onPress: () => router.back() }],
          );
        },
        // Surface the server message — notably the schedule-conflict block
        // ("يتعارض مع … في نفس اليوم").
        onError: (e: any) => Alert.alert(t('teacher.schedule_create_failed'), e?.response?.data?.message || undefined),
      },
    );
  };

  const label = (s: string) => (
    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.lg }}>{s}</Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.add_schedule_title')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (courses ?? []).length === 0 ? (
        <EmptyState icon="calendar" title={t('teacher.schedule_no_courses')} message={t('teacher.add_schedule_hint')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs }}>
            {t('teacher.add_schedule_hint')}
          </Text>

          {/* Course */}
          {label(t('teacher.schedule_course'))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(courses ?? []).map((c) => {
              const active = c.id === courseId;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setCourseId(c.id)}
                  style={{ paddingHorizontal: spacing.lg, minHeight: 40, justifyContent: 'center', borderRadius: radius.full, backgroundColor: active ? colors.brand : colors.surface, borderWidth: 1, borderColor: active ? colors.brand : colors.border }}
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: active ? '#fff' : colors.textSecondary }}>{c.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Day of week */}
          {label(t('teacher.schedule_day'))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {DAYS_AR.map((d, i) => {
              const active = i === day;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setDay(i)}
                  style={{ paddingHorizontal: spacing.md, minHeight: 40, justifyContent: 'center', borderRadius: radius.full, backgroundColor: active ? colors.brand : colors.surface, borderWidth: 1, borderColor: active ? colors.brand : colors.border }}
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: active ? '#fff' : colors.textSecondary }}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Times */}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              {label(t('teacher.schedule_start'))}
              <TimePicker value={start || null} onChange={setStart} />
            </View>
            <View style={{ flex: 1 }}>
              {label(t('teacher.schedule_end'))}
              <TimePicker value={end || null} onChange={setEnd} invalid={startValid && endValid && end <= start} />
            </View>
          </View>
          {startValid && endValid && end <= start ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.danger, marginTop: spacing.xs }}>{t('teacher.schedule_end_after')}</Text>
          ) : null}

          {/* Capacity */}
          {label(t('teacher.schedule_capacity'))}
          <TextInput
            value={capacity}
            onChangeText={(v) => setCapacity(v.replace(/[^0-9]/g, ''))}
            placeholder={t('teacher.schedule_capacity_ph')}
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            maxLength={4}
            style={{ fontFamily: fonts.regular, fontSize: 16, minHeight: 52, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, paddingHorizontal: spacing.lg, color: colors.textPrimary, textAlign: 'center' }}
          />

          {/* Submit */}
          <TouchableOpacity
            onPress={submit}
            disabled={create.isPending}
            style={{ marginTop: spacing.xl, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}
          >
            {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('teacher.schedule_submit')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}
