import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
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
  const canSubmit = courseId !== null && startValid && endValid && orderValid && !create.isPending;

  const submit = () => {
    if (courseId === null || !startValid || !endValid || !orderValid) return;
    const cap = capacity.trim() ? Number(capacity.trim()) : undefined;
    create.mutate(
      {
        course_id: courseId,
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
        onError: () => Alert.alert(t('teacher.schedule_create_failed')),
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
          <Icon name="back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.add_schedule_title')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (courses ?? []).length === 0 ? (
        <EmptyState icon="calendar" title={t('teacher.schedule_no_courses')} message={t('teacher.add_schedule_hint')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
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
              <TextInput
                value={start}
                onChangeText={setStart}
                placeholder={t('teacher.schedule_time_ph')}
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                style={{ fontFamily: fonts.regular, fontSize: 16, minHeight: 52, backgroundColor: colors.surface, borderWidth: 1, borderColor: start && !startValid ? colors.danger : colors.borderStrong, borderRadius: radius.lg, paddingHorizontal: spacing.lg, color: colors.textPrimary, textAlign: 'center' }}
              />
            </View>
            <View style={{ flex: 1 }}>
              {label(t('teacher.schedule_end'))}
              <TextInput
                value={end}
                onChangeText={setEnd}
                placeholder={t('teacher.schedule_time_ph')}
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                style={{ fontFamily: fonts.regular, fontSize: 16, minHeight: 52, backgroundColor: colors.surface, borderWidth: 1, borderColor: end && !endValid ? colors.danger : colors.borderStrong, borderRadius: radius.lg, paddingHorizontal: spacing.lg, color: colors.textPrimary, textAlign: 'center' }}
              />
            </View>
          </View>
          {end && endValid && startValid && !orderValid ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.danger, marginTop: spacing.xs }}>{t('teacher.schedule_end_after')}</Text>
          ) : (start && !startValid) || (end && !endValid) ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.danger, marginTop: spacing.xs }}>{t('teacher.schedule_time_invalid')}</Text>
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
            disabled={!canSubmit}
            style={{ marginTop: spacing.xl, minHeight: 52, borderRadius: radius.lg, backgroundColor: canSubmit ? colors.primary : colors.borderStrong, justifyContent: 'center', alignItems: 'center' }}
          >
            {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('teacher.schedule_submit')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}
