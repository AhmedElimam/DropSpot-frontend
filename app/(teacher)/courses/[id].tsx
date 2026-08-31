import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Switch, Alert, KeyboardAvoidingView } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatTime12 } from '@/components/ui/TimePicker';
import { Button } from '@/components/ui/Button';
import { useCourseDetail, useUpdateCourseSettings, useUpdateCourseLocation, useRemoveSchedule, useDeleteCourse } from '@/hooks/useCourses';
import { useTeacherOnboarding } from '@/hooks/useTeacherOnboarding';
import type { CourseSchedule } from '@/api/courses';

// Matches Course::PREFERRED_ACCURACY_METERS — a worse GPS fix is flagged low-confidence.
const PREFERRED_ACCURACY = 20;

export default function CourseDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: course, isLoading } = useCourseDetail(id);
  // Teacher's down-payment IS the booklet → a separate booking price doesn't apply.
  const bookletIsDownPayment = course?.booklet_is_down_payment ?? false;
  const { data: onboarding } = useTeacherOnboarding();
  const saveSettings = useUpdateCourseSettings(id);
  const saveLocation = useUpdateCourseLocation(id);
  const removeSlot = useRemoveSchedule(id);

  // Editable settings mirror the web edit form; seeded once the detail loads.
  const [radius_, setRadius] = useState(20);
  const [allowSwap, setAllowSwap] = useState(true);
  const [sheetDefault, setSheetDefault] = useState(false);
  const [sheetMax, setSheetMax] = useState('');
  const [perCycle, setPerCycle] = useState<number | null>(null);
  const [cyclePrice, setCyclePrice] = useState('');
  const [bookletPrice, setBookletPrice] = useState('');
  const [bookingPrice, setBookingPrice] = useState('');
  // Explicit on/off for the two optional charges (mirrors the web toggles); default
  // on when the course already carries that price, off otherwise.
  const [hasBooklet, setHasBooklet] = useState(false);
  const [hasBooking, setHasBooking] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (course && !seeded) {
      setRadius(course.radius_horizontal_meters ?? 20);
      setAllowSwap(course.allow_session_swap ?? true);
      setSheetDefault(course.sheet_expected_by_default);
      setSheetMax(course.sheet_max_mark != null ? String(course.sheet_max_mark) : '');
      setPerCycle(course.sessions_per_billing_cycle);
      setCyclePrice(course.cycle_price != null ? String(course.cycle_price) : '');
      setBookletPrice(course.booklet_price != null ? String(course.booklet_price) : '');
      setBookingPrice(course.booking_price != null ? String(course.booking_price) : '');
      setHasBooklet(course.booklet_price != null);
      setHasBooking(course.booking_price != null);
      setSeeded(true);
    }
  }, [course, seeded]);

  const onSaveSettings = () => {
    saveSettings.mutate(
      {
        radius_horizontal_meters: radius_,
        allow_session_swap: allowSwap,
        sheet_expected_by_default: sheetDefault,
        sheet_max_mark: sheetMax.trim() ? Number(sheetMax.trim()) : null,
        sessions_per_billing_cycle: perCycle ?? undefined,
        cycle_price: cyclePrice.trim() ? Number(cyclePrice.trim()) : null,
        booklet_price: hasBooklet && bookletPrice.trim() ? Number(bookletPrice.trim()) : null,
        booking_price: hasBooking && !bookletIsDownPayment && bookingPrice.trim() ? Number(bookingPrice.trim()) : null,
      },
      {
        onSuccess: () => Alert.alert(t('teacher.course_saved')),
        onError: () => Alert.alert(t('common.error'), t('teacher.course_save_failed')),
      },
    );
  };

  const captureLocation = async () => {
    setCapturing(true);
    try {
      // 1) OS-level location services must be on.
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        Alert.alert(t('teacher.location_services_off_title'), t('teacher.location_services_off_hint'));
        return;
      }
      // 2) App permission.
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(t('teacher.location_denied_title'), t('teacher.location_denied_hint'));
        return;
      }
      // 3) A fresh fix. 'High' (not 'Highest') is far more reliable INDOORS — a
      //    classroom — where Highest can hang/throw. Fall back to the last known
      //    fix so a slow GPS never blocks the teacher entirely.
      let pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null);
      if (!pos) {
        pos = await Location.getLastKnownPositionAsync();
      }
      if (!pos) {
        Alert.alert(t('teacher.location_no_fix_title'), t('teacher.location_no_fix_hint'));
        return;
      }

      const acc = pos.coords.accuracy ?? undefined;
      saveLocation.mutate(
        {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          location_accuracy_meters: acc,
          location_source: acc != null && acc > PREFERRED_ACCURACY ? 'gps_low' : 'gps',
        },
        {
          onSuccess: (fresh) =>
            Alert.alert(
              t('teacher.location_saved'),
              fresh.location_low_confidence ? t('teacher.location_low_confidence') : t('teacher.phone_checkin_on'),
            ),
          // Surface the server's own reason (validation / auth) instead of a generic line.
          onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.location_save_failed')),
        },
      );
    } catch (e: any) {
      // Surface the real device error (e.g. a missing native module or disabled
      // GPS) so a persistent failure is diagnosable rather than an opaque "error".
      Alert.alert(t('common.error'), e?.message ? String(e.message) : t('teacher.location_capture_failed'));
    } finally {
      setCapturing(false);
    }
  };

  const deleteCourse = useDeleteCourse(id);

  // Hard-delete the whole course (schedule master). Server blocks it while active students
  // remain (422). Irreversible.
  const confirmDeleteCourse = () => {
    Alert.alert(
      'حذف المقرر نهائيًا',
      'سيُمحى المقرر وكل ما يخصه (المواعيد، الحصص، السجلات) نهائيًا. لا يمكن التراجع. غير متاح إن كان به طلاب نشطون.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'حذف نهائيًا',
          style: 'destructive',
          onPress: () =>
            deleteCourse.mutate(undefined, {
              onSuccess: () => router.back(),
              onError: (e: any) =>
                Alert.alert(t('common.error'), e?.response?.data?.message ?? 'تعذّر حذف المقرر'),
            }),
        },
      ],
    );
  };

  const retireSlot = (slot: CourseSchedule) => {
    Alert.alert(
      t('teacher.retire_slot_title'),
      `${slot.day_label} ${formatTime12(slot.start_time)}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('teacher.retire_slot_confirm'),
          style: 'destructive',
          onPress: () =>
            removeSlot.mutate(slot.id, {
              onError: (e: any) =>
                Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.retire_slot_failed')),
            }),
        },
      ],
    );
  };

  if (isLoading || !course) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const located = course.has_location;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }} numberOfLines={1}>{course.name}</Text>
          {course.grade_name ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{course.grade_name}</Text> : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
        {/* Location / phone check-in (automated) */}
        <Section icon="location" title={t('teacher.location_section')} />
        {onboarding?.active ? (
          <View style={{ backgroundColor: colors.brandTint, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.brand, textAlign: 'right' }}>
              {t('onboarding.location_hint')}
            </Text>
          </View>
        ) : null}
        <View style={{ backgroundColor: located ? colors.successLight : colors.warningLight, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="location" size={20} color={located ? colors.success : colors.warning} />
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
              {located ? t('teacher.phone_checkin_auto_on') : t('teacher.phone_checkin_off')}
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
            {located ? t('teacher.location_set_hint') : t('teacher.location_missing_hint')}
          </Text>
          {located && course.latitude != null ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary, marginTop: 6 }}>
              {course.latitude.toFixed(6)}, {course.longitude?.toFixed(6)}
              {course.location_accuracy_meters != null ? ` · ±${Math.round(course.location_accuracy_meters)}m` : ''}
            </Text>
          ) : null}
          {located && course.location_low_confidence ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.warning, marginTop: 6 }}>
              {t('teacher.location_low_confidence')}
            </Text>
          ) : null}
          <View style={{ marginTop: spacing.md }}>
            <Button
              title={located ? t('teacher.recapture_location') : t('teacher.capture_location')}
              onPress={captureLocation}
              loading={capturing || saveLocation.isPending}
              variant={located ? 'outline' : 'primary'}
            />
          </View>
        </View>

        {/* Settings */}
        <Section icon="settings" title={t('teacher.settings_section')} />

        {/* Radius stepper */}
        <FieldLabel>{t('teacher.radius_label')}</FieldLabel>
        <Stepper value={radius_} min={5} max={50} step={5} onChange={setRadius} suffix={t('teacher.meters')} />

        {/* Session-swap permission toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg }}>
          <View style={{ flex: 1, paddingEnd: spacing.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('teacher.allow_swap_label')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('teacher.allow_swap_hint')}</Text>
          </View>
          <Switch value={allowSwap} onValueChange={setAllowSwap} trackColor={{ true: colors.brand }} />
        </View>

        {/* Sheet default toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg }}>
          <View style={{ flex: 1, paddingEnd: spacing.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('teacher.sheet_default_label')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('teacher.sheet_default_hint')}</Text>
          </View>
          <Switch value={sheetDefault} onValueChange={setSheetDefault} trackColor={{ true: colors.brand }} />
        </View>

        <FieldLabel>{t('teacher.sheet_max_label')}</FieldLabel>
        <NumberInput value={sheetMax} onChangeText={setSheetMax} placeholder={t('teacher.optional')} />

        {/* Billing */}
        <FieldLabel>{t('teacher.per_cycle_label')}</FieldLabel>
        <Stepper
          value={perCycle ?? course.min_sessions_per_cycle}
          min={course.min_sessions_per_cycle}
          max={course.max_sessions_per_cycle}
          step={1}
          onChange={setPerCycle}
          suffix={t('teacher.sessions_unit')}
        />

        <FieldLabel>{t('teacher.cycle_price_label')}</FieldLabel>
        <NumberInput value={cyclePrice} onChangeText={setCyclePrice} placeholder={t('teacher.egp')} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary }}>{t('teacher.booklet_price_label')}</Text>
          <Switch value={hasBooklet} onValueChange={(v) => { setHasBooklet(v); if (!v) setBookletPrice(''); }} trackColor={{ true: colors.brand }} />
        </View>
        {hasBooklet ? (
          <NumberInput value={bookletPrice} onChangeText={setBookletPrice} placeholder={t('teacher.egp')} />
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary }}>{t('teacher.booking_price_label')}</Text>
          <Switch value={hasBooking && !bookletIsDownPayment} disabled={bookletIsDownPayment} onValueChange={(v) => { setHasBooking(v); if (!v) setBookingPrice(''); }} trackColor={{ true: colors.brand }} />
        </View>
        {bookletIsDownPayment ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{t('teacher.booking_is_booklet')}</Text>
        ) : hasBooking ? (
          <NumberInput value={bookingPrice} onChangeText={setBookingPrice} placeholder={t('teacher.egp')} />
        ) : null}

        <View style={{ marginTop: spacing.xl }}>
          <Button title={t('teacher.save_settings')} onPress={onSaveSettings} loading={saveSettings.isPending} variant="primary" />
        </View>

        {/* Weekly slots */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.sm }}>
          <Section icon="calendar" title={t('teacher.slots_section')} inline />
          <TouchableOpacity
            onPress={() => router.push('/(teacher)/schedule-new' as Href)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.full, backgroundColor: colors.brandTint }}
          >
            <Icon name="add" size={16} color={colors.brand} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.add_slot')}</Text>
          </TouchableOpacity>
        </View>

        {course.schedules.length === 0 ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginVertical: spacing.md }}>{t('teacher.no_slots')}</Text>
        ) : (
          course.schedules.map((slot) => (
            <View key={slot.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{slot.day_label} · {formatTime12(slot.start_time)}–{formatTime12(slot.end_time)}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {t('teacher.students_count', { count: slot.headcount })}
                  {slot.capacity != null ? ` / ${slot.capacity}` : ''} · {t('teacher.upcoming_count', { count: slot.upcoming_count })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => retireSlot(slot)} disabled={removeSlot.isPending} style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.dangerLight, justifyContent: 'center', alignItems: 'center' }}>
                <Icon name="trash" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Danger zone — hard-delete the whole course (schedule master). */}
        <View style={{ marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.danger, marginBottom: 4 }}>منطقة الخطر</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginBottom: spacing.sm }}>
            حذف المقرر نهائيًا يزيل مواعيده وحصصه وسجلّاته. لا يمكن التراجع. غير متاح إن كان به طلاب نشطون.
          </Text>
          <TouchableOpacity
            onPress={confirmDeleteCourse}
            disabled={deleteCourse.isPending}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.lg, paddingVertical: spacing.md, opacity: deleteCourse.isPending ? 0.6 : 1 }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.danger }}>{deleteCourse.isPending ? '…جارٍ الحذف' : 'حذف المقرر نهائيًا'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---- small presentational helpers ----

function Section({ icon, title, inline }: { icon: any; title: string; inline?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: inline ? 0 : spacing.xl, marginBottom: inline ? 0 : spacing.sm }}>
      <Icon name={icon} size={18} color={colors.brand} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{title}</Text>
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm }}>{children}</Text>;
}

function NumberInput({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      keyboardType="numeric"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }}
    />
  );
}

function Stepper({ value, min, max, step, onChange, suffix }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix?: string }) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <TouchableOpacity onPress={dec} style={stepBtn}><Text style={stepTxt}>−</Text></TouchableOpacity>
      <View style={{ minWidth: 90, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{value}{suffix ? ` ${suffix}` : ''}</Text>
      </View>
      <TouchableOpacity onPress={inc} style={stepBtn}><Text style={stepTxt}>+</Text></TouchableOpacity>
    </View>
  );
}

const stepBtn = { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' } as const;
const stepTxt = { fontFamily: fonts.bold, fontSize: 24, color: colors.brand } as const;
