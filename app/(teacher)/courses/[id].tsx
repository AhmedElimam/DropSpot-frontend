import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatTime12 } from '@/components/ui/TimePicker';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { FormScreen, FormCard, Field, Input, NumberInput, Stepper, SwitchRow, Banner } from '@/components/ui/Form';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { useCourseDetail, useUpdateCourseSettings, useUpdateCourseLocation, useRemoveSchedule, useDeleteCourse } from '@/hooks/useCourses';
import { getCourseFormOptions } from '@/api/courses';
import { useTeacherOnboarding } from '@/hooks/useTeacherOnboarding';
import { formatNumber } from '@/utils/format';
import type { CourseSchedule } from '@/api/courses';

// Matches Course::PREFERRED_ACCURACY_METERS — a worse GPS fix is flagged low-confidence.
const PREFERRED_ACCURACY = 20;

export default function CourseDetailScreen() {
  const { t } = useTranslation();
  // An assistant sees only what they can change (founder 2026-09-26): settings and slot
  // removal need manage_courses, a new slot manage_sessions; the check-in anchor and
  // deleting the course are the teacher's alone.
  const { can, isAssistant } = useActiveAbilities();
  const canCourses = can(ABILITY.MANAGE_COURSES);
  const canSessions = can(ABILITY.MANAGE_SESSIONS);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: course, isLoading } = useCourseDetail(id);
  // Teacher's down-payment IS the booklet → a separate booking price doesn't apply.
  const bookletIsDownPayment = course?.booklet_is_down_payment ?? false;
  const { data: onboarding } = useTeacherOnboarding();
  const saveSettings = useUpdateCourseSettings(id);
  const saveLocation = useUpdateCourseLocation(id);
  const removeSlot = useRemoveSchedule(id);
  const deleteCourse = useDeleteCourse(id);

  // Editable settings mirror the web edit form; seeded once the detail loads.
  const [name, setName] = useState('');
  const [radius_, setRadius] = useState(20);
  const [allowSwap, setAllowSwap] = useState(true);
  const [sheetDefault, setSheetDefault] = useState(false);
  const [sheetMax, setSheetMax] = useState('');
  const [perCycle, setPerCycle] = useState<number | null>(null);
  const [cyclePrice, setCyclePrice] = useState('');
  const [bookletPrice, setBookletPrice] = useState('');
  const [bookingPrice, setBookingPrice] = useState('');
  const [hasBooklet, setHasBooklet] = useState(false);
  const [hasBooking, setHasBooking] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [seeded, setSeeded] = useState(false);
  // Optional venue — the same list the create form uses; without venues the field is not offered.
  const [venueId, setVenueId] = useState<string | null>(null);
  const { data: formOptions } = useQuery({ queryKey: ['course-form-options'], queryFn: getCourseFormOptions, staleTime: 300_000 });
  const venues = formOptions?.venues ?? [];

  useEffect(() => {
    if (course && !seeded) {
      setName(course.name ?? '');
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
      setVenueId(course.teacher_location_id ?? null);
      setSeeded(true);
    }
  }, [course, seeded]);

  const onSaveSettings = () => {
    if (!name.trim()) { Alert.alert(t('common.error'), t('teacher.course_name_required')); return; }
    saveSettings.mutate(
      {
        name: name.trim(),
        teacher_location_id: venueId,
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
      if (!enabled) { Alert.alert(t('teacher.location_services_off_title'), t('teacher.location_services_off_hint')); return; }
      // 2) App permission.
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert(t('teacher.location_denied_title'), t('teacher.location_denied_hint')); return; }
      // 3) A fresh fix. 'High' (not 'Highest') is far more reliable INDOORS — a classroom —
      //    where Highest can hang/throw. Fall back to the last known fix so a slow GPS
      //    never blocks the teacher entirely.
      let pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null);
      if (!pos) pos = await Location.getLastKnownPositionAsync();
      if (!pos) { Alert.alert(t('teacher.location_no_fix_title'), t('teacher.location_no_fix_hint')); return; }

      const acc = pos.coords.accuracy ?? undefined;
      saveLocation.mutate(
        { latitude: pos.coords.latitude, longitude: pos.coords.longitude, location_accuracy_meters: acc, location_source: acc != null && acc > PREFERRED_ACCURACY ? 'gps_low' : 'gps' },
        {
          onSuccess: (fresh) => Alert.alert(t('teacher.location_saved'), fresh.location_low_confidence ? t('teacher.location_low_confidence') : t('teacher.phone_checkin_on')),
          // Surface the server's own reason (validation / auth) instead of a generic line.
          onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.location_save_failed')),
        },
      );
    } catch (e: any) {
      // Surface the real device error so a persistent failure is diagnosable.
      Alert.alert(t('common.error'), e?.message ? String(e.message) : t('teacher.location_capture_failed'));
    } finally {
      setCapturing(false);
    }
  };

  // Hard-delete the whole course (schedule master). Server blocks it while active students remain (422).
  const confirmDeleteCourse = () => {
    Alert.alert('حذف المقرر نهائيًا', 'سيُمحى المقرر وكل ما يخصه (المواعيد، الحصص، السجلات) نهائيًا. لا يمكن التراجع. غير متاح إن كان به طلاب نشطون.', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: 'حذف نهائيًا', style: 'destructive', onPress: () => deleteCourse.mutate(undefined, { onSuccess: () => router.back(), onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? 'تعذّر حذف المقرر') }) },
    ]);
  };

  const retireSlot = (slot: CourseSchedule) => {
    Alert.alert(t('teacher.retire_slot_title'), `${slot.day_label} ${formatTime12(slot.start_time)}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('teacher.retire_slot_confirm'), style: 'destructive', onPress: () => removeSlot.mutate(slot.id, { onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.retire_slot_failed')) }) },
    ]);
  };

  if (isLoading || !course) {
    return <FormScreen title={t('teacher.courses_title')} loading><View /></FormScreen>;
  }

  const located = course.has_location;
  const venueOptions = [{ key: '', label: 'بدون مكان محدد' }, ...venues.map((v) => ({ key: v.id, label: v.address ? `${v.name} — ${v.address}` : v.name }))];

  return (
    <FormScreen title={course.name} subtitle={course.grade_name ?? undefined}>
      {/* Where the phone check-in anchors — the card's colour IS the status. */}
      {onboarding?.active ? <Banner tone="info" text={t('onboarding.location_hint')} /> : null}
      <FormCard icon="location" title={t(located ? 'teacher.phone_checkin_auto_on' : 'teacher.phone_checkin_off')} hint={t(located ? 'teacher.location_set_hint' : 'teacher.location_missing_hint')} tint={located ? colors.success : colors.warning}>
        {located && course.latitude != null ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary, writingDirection: 'ltr', textAlign: 'right' }}>
            {course.latitude.toFixed(6)}, {course.longitude?.toFixed(6)}{course.location_accuracy_meters != null ? ` · ±${Math.round(course.location_accuracy_meters)}m` : ''}
          </Text>
        ) : null}
        {located && course.location_low_confidence ? <Banner tone="warn" text={t('teacher.location_low_confidence')} style={{ marginTop: spacing.sm, marginBottom: 0 }} /> : null}
        {!isAssistant ? (
          <View style={{ marginTop: spacing.md }}>
            <Button title={t(located ? 'teacher.recapture_location' : 'teacher.capture_location')} onPress={captureLocation} loading={capturing || saveLocation.isPending} variant={located ? 'outline' : 'primary'} />
          </View>
        ) : null}
      </FormCard>

      {canCourses ? (
        <>
          <FormCard icon="book" title={t('teacher.section_basics')}>
            <Field label={t('teacher.course_name_label')} first>
              <Input value={name} onChangeText={setName} placeholder={t('teacher.course_name_label')} maxLength={255} />
            </Field>
            <Field label="مكان التدريس" hint={t('form_ui.optional')}>
              {venues.length > 0 ? (
                <SelectField value={venueId ?? ''} options={venueOptions} placeholder="بدون مكان محدد" onChange={(v) => setVenueId(v || null)} />
              ) : !isAssistant ? (
                <TouchableOpacity onPress={() => router.push('/(teacher)/venues' as Href)} activeOpacity={0.8}
                  style={{ minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.brandTint }}>
                  <Icon name="add" size={16} color={colors.brand} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>أضِف أماكن التدريس أولًا</Text>
                </TouchableOpacity>
              ) : null}
            </Field>
          </FormCard>

          <FormCard icon="attendance" title={t('teacher.settings_section')} tint={colors.accent}>
            <Field label={t('teacher.radius_label')} first>
              <Stepper value={radius_} min={5} max={50} step={5} onChange={setRadius} suffix={t('teacher.meters')} />
            </Field>
            <SwitchRow title={t('teacher.allow_swap_label')} hint={t('teacher.allow_swap_hint')} value={allowSwap} onChange={setAllowSwap} />
            <SwitchRow title={t('teacher.sheet_default_label')} hint={t('teacher.sheet_default_hint')} value={sheetDefault} onChange={setSheetDefault} />
            <Field label={t('teacher.sheet_max_label')} hint={t('form_ui.optional')}>
              <NumberInput value={sheetMax} onChangeText={setSheetMax} decimals placeholder={t('teacher.optional')} />
            </Field>
          </FormCard>

          <FormCard icon="money" title={t('teacher.billing_section')} tint={colors.success}>
            <Field label={t('teacher.per_cycle_label')} first>
              <Stepper value={perCycle ?? course.min_sessions_per_cycle} min={course.min_sessions_per_cycle} max={course.max_sessions_per_cycle} step={1} onChange={setPerCycle} suffix={t('teacher.sessions_unit')} />
            </Field>
            <Field label={t('teacher.cycle_price_label')}>
              <NumberInput value={cyclePrice} onChangeText={setCyclePrice} decimals placeholder={t('teacher.egp')} suffix={t('teacher.egp')} />
            </Field>
            <SwitchRow title={t('teacher.booklet_price_label')} value={hasBooklet} onChange={(v) => { setHasBooklet(v); if (!v) setBookletPrice(''); }} />
            {hasBooklet ? <View style={{ marginTop: spacing.sm }}><NumberInput value={bookletPrice} onChangeText={setBookletPrice} decimals placeholder={t('teacher.egp')} suffix={t('teacher.egp')} /></View> : null}
            <SwitchRow title={t('teacher.booking_price_label')} hint={bookletIsDownPayment ? t('teacher.booking_is_booklet') : undefined}
              value={hasBooking && !bookletIsDownPayment} disabled={bookletIsDownPayment} onChange={(v) => { setHasBooking(v); if (!v) setBookingPrice(''); }} />
            {hasBooking && !bookletIsDownPayment ? <View style={{ marginTop: spacing.sm }}><NumberInput value={bookingPrice} onChangeText={setBookingPrice} decimals placeholder={t('teacher.egp')} suffix={t('teacher.egp')} /></View> : null}
          </FormCard>

          <View style={{ marginBottom: spacing.lg }}>
            <Button title={t('teacher.save_settings')} onPress={onSaveSettings} loading={saveSettings.isPending} variant="primary" />
          </View>
        </>
      ) : null}

      {/* Weekly slots */}
      <FormCard icon="calendar" title={t('teacher.slots_section')} tint={colors.accent}
        action={canSessions ? (
          <TouchableOpacity onPress={() => router.push('/(teacher)/schedule-new' as Href)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.full, backgroundColor: colors.accentLight }}>
            <Icon name="add" size={16} color={colors.onAccent} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onAccent }}>{t('teacher.add_slot')}</Text>
          </TouchableOpacity>
        ) : undefined}>
        {course.schedules.length === 0 ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('teacher.no_slots')}</Text>
        ) : (
          course.schedules.map((slot) => (
            <View key={slot.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStartWidth: 4, borderStartColor: colors.accent, padding: spacing.md, marginBottom: spacing.sm }}>
              <View style={{ width: 44, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} numberOfLines={1} adjustsFontSizeToFit>{slot.day_label}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{formatTime12(slot.start_time)} – {formatTime12(slot.end_time)}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {t('form_ui.students_n', { n: formatNumber(slot.headcount) })}{slot.capacity != null ? ` / ${formatNumber(slot.capacity)}` : ''} · {t('teacher.upcoming_count', { count: slot.upcoming_count })}
                </Text>
              </View>
              {canCourses ? (
                <TouchableOpacity onPress={() => retireSlot(slot)} disabled={removeSlot.isPending} accessibilityRole="button" accessibilityLabel={t('teacher.retire_slot_confirm')}
                  style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.dangerLight, justifyContent: 'center', alignItems: 'center' }}>
                  {removeSlot.isPending && removeSlot.variables === slot.id ? <ActivityIndicator size="small" color={colors.danger} /> : <Icon name="trash" size={18} color={colors.danger} />}
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </FormCard>

      {/* Danger zone — hard-delete the whole course. Teacher only. */}
      {!isAssistant ? (
        <FormCard icon="warning" title="منطقة الخطر" hint="حذف المقرر نهائيًا يزيل مواعيده وحصصه وسجلّاته. لا يمكن التراجع. غير متاح إن كان به طلاب نشطون." tint={colors.danger} style={{ borderColor: colors.danger + '55' }}>
          <Button title={deleteCourse.isPending ? '…جارٍ الحذف' : 'حذف المقرر نهائيًا'} onPress={confirmDeleteCourse} loading={deleteCourse.isPending} variant="destructive" />
        </FormCard>
      ) : null}
    </FormScreen>
  );
}
