import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { formatMoney } from '@/utils/currency';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { TimePicker } from '@/components/ui/TimePicker';
import { SelectField } from '@/components/ui/SelectField';
import { FormScreen, FormCard, Field, Input, NumberInput, Chips, DayPicker, Stepper, SwitchRow, Banner, DateStrip, TimeRangeRow, upcomingDays } from '@/components/ui/Form';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { useCourseFormOptions, useCreateCourse } from '@/hooks/useCourses';
import { useTeacherOnboarding, useMarkOnboardingStep } from '@/hooks/useTeacherOnboarding';
import { formatNumber } from '@/utils/format';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
type Slot = { day_of_week: number; start_time: string; end_time: string };

/**
 * Create a course — parity with the web /courses/create: name, grade, venue, term, start,
 * capacity, radius, description, weekly slots and the (required) session-based billing.
 * On success, jumps to the new course's settings.
 */
export default function CourseCreateScreen() {
  const { t } = useTranslation();
  // Venue writes are the teacher's alone — an assistant is not sent to a screen that refuses them.
  const { isAssistant } = useActiveAbilities();
  const { data: options, isLoading } = useCourseFormOptions();
  // Teacher's down-payment IS the booklet → a separate booking price doesn't apply.
  const bookletIsDownPayment = options?.booklet_is_down_payment ?? false;
  const create = useCreateCourse();
  const { data: onboarding } = useTeacherOnboarding();
  const markStep = useMarkOnboardingStep();
  const [showExplainer, setShowExplainer] = useState(false);
  const explainerMarked = useRef(false);

  const [name, setName] = useState('');
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [termId, setTermId] = useState<string | null>(null);
  const [capacity, setCapacity] = useState('');
  const [radius_, setRadius] = useState(20);
  const [allowSwap, setAllowSwap] = useState(true);
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  // "When do you want to start" — now (mint this week's remaining days immediately) or
  // a specific date (holds generation until then).
  const [startMode, setStartMode] = useState<'now' | 'date'>('now');
  const [startDate, setStartDate] = useState<string | null>(null);
  const days = useRef(upcomingDays(45)).current;
  // Pricing — session-based billing is required; booklet / booking are optional charges.
  const [cycleSessions, setCycleSessions] = useState('8');
  const [cyclePrice, setCyclePrice] = useState('');
  const [bookletPrice, setBookletPrice] = useState('');
  const [bookingPrice, setBookingPrice] = useState('');
  const [hasBooklet, setHasBooklet] = useState(false);
  const [hasBooking, setHasBooking] = useState(false);

  const perSession = (() => {
    const p = parseFloat(cyclePrice);
    const n = parseInt(cycleSessions, 10);
    return p > 0 && n > 0 ? formatMoney(p / n) : null;
  })();

  useEffect(() => {
    if (options && termId === null) {
      setTermId(options.current_term_id);
      setRadius(options.default_radius ?? 20);
    }
  }, [options, termId]);

  // Onboarding Step 2: show the explainer once when due, and mark course_form seen.
  const explainerDue = !!onboarding?.active && !onboarding.steps.course_form;
  useEffect(() => {
    if (explainerDue && !explainerMarked.current) {
      explainerMarked.current = true;
      setShowExplainer(true);
      markStep.mutate('course_form');
    }
  }, [explainerDue]); // eslint-disable-line react-hooks/exhaustive-deps

  const slotsValid = slots.every((s) => TIME_RE.test(s.start_time) && TIME_RE.test(s.end_time) && s.end_time > s.start_time);
  const billingValid = parseFloat(cyclePrice) >= 1 && parseInt(cycleSessions, 10) >= 1;
  const startValid = startMode === 'now' || !!startDate;
  const canSubmit = name.trim().length > 0 && !!gradeId && !!termId && slotsValid && billingValid && startValid && !create.isPending;

  const addSlot = () => setSlots((s) => [...s, { day_of_week: 6, start_time: '16:00', end_time: '18:00' }]);
  const removeSlot = (i: number) => setSlots((s) => s.filter((_, idx) => idx !== i));
  const setSlot = (i: number, patch: Partial<Slot>) => setSlots((s) => s.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submit = () => {
    if (!canSubmit || !gradeId || !termId) return;
    create.mutate(
      {
        name: name.trim(),
        grade_id: Number(gradeId),
        academic_session_id: Number(termId),
        capacity: capacity.trim() ? Number(capacity.trim()) : undefined,
        teacher_location_id: venueId,
        radius_horizontal_meters: radius_,
        allow_session_swap: allowSwap,
        starts_at: startMode === 'date' && startDate ? startDate : undefined,
        description: description.trim() || undefined,
        slots: slots.length ? slots : undefined,
        sessions_per_billing_cycle: Number(cycleSessions.trim()),
        cycle_price: Number(cyclePrice.trim()),
        booklet_price: hasBooklet && bookletPrice.trim() ? Number(bookletPrice.trim()) : null,
        booking_price: hasBooking && !bookletIsDownPayment && bookingPrice.trim() ? Number(bookingPrice.trim()) : null,
      },
      {
        onSuccess: (res) => {
          // Onboarding Step 3: a popup showing the auto-generated sessions, then the detail.
          const sessionsDue = !!onboarding?.active && !onboarding.steps.sessions;
          if (sessionsDue) markStep.mutate('sessions');
          const title = sessionsDue ? t('onboarding.sessions_title') : t('teacher.create_course');
          const body = sessionsDue
            ? (res.generated > 0 ? t('onboarding.sessions_body', { count: res.generated }) : t('onboarding.sessions_body_none'))
            : (res.term_ended ? t('teacher.create_term_ended') : t('teacher.create_done', { count: res.generated }));
          Alert.alert(title, body, [{ text: sessionsDue ? t('onboarding.view_course') : t('common.ok'), onPress: () => router.replace(`/(teacher)/courses/${res.course.id}` as Href) }]);
        },
        onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.create_failed')),
      },
    );
  };

  const venueOptions = [{ key: '', label: 'بدون مكان محدد' }, ...(options?.venues ?? []).map((v) => ({ key: v.id, label: v.address ? `${v.name} — ${v.address}` : v.name }))];

  return (
    <FormScreen title={t('teacher.create_course')} subtitle={t('teacher.create_course_sub')} loading={isLoading || !options}>
      {options ? (
        <>
          {showExplainer ? (
            <Banner tone="info" icon="book">
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('onboarding.course_form_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 2 }}>{t('onboarding.course_form_body')}</Text>
            </Banner>
          ) : null}

          {/* ── Basics ── */}
          <FormCard icon="book" title={t('teacher.section_basics')} required>
            <Field label={t('teacher.course_name')} required first>
              <Input value={name} onChangeText={setName} placeholder={t('teacher.course_name_ph')} maxLength={255} />
            </Field>
            <Field label={t('teacher.grade')} required>
              <SelectField value={gradeId} options={options.grades.map((g) => ({ key: g.id, label: g.name }))} placeholder={t('teacher.grade_ph')} onChange={setGradeId} />
            </Field>
            <Field label={t('teacher.term')} required>
              <Chips options={options.terms.map((tm) => ({ key: tm.id, label: tm.name + (tm.ended ? ` — ${t('teacher.term_ended_tag')}` : '') }))} value={termId} onChange={setTermId} />
            </Field>
            {/* Venue — optional. With none yet, show the way to add one rather than nothing. */}
            <Field label="مكان التدريس" hint={t('form_ui.optional')}>
              {(options.venues?.length ?? 0) > 0 ? (
                <SelectField value={venueId ?? ''} options={venueOptions} placeholder="بدون مكان محدد" onChange={(id) => setVenueId(id || null)} />
              ) : !isAssistant ? (
                <TouchableOpacity onPress={() => router.push('/(teacher)/venues' as Href)} activeOpacity={0.8}
                  style={{ minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.brandTint }}>
                  <Icon name="add" size={16} color={colors.brand} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>أضِف أماكن التدريس أولًا</Text>
                </TouchableOpacity>
              ) : null}
            </Field>
          </FormCard>

          {/* ── Start ── */}
          <FormCard icon="calendar" title={t('teacher.start_when')} hint={t('teacher.start_hint')} tint={colors.success}>
            <Chips fill tint={colors.success}
              options={[{ key: 'now' as const, label: t('teacher.start_now'), icon: 'clock' }, { key: 'date' as const, label: t('teacher.start_on_date'), icon: 'calendar' }]}
              value={startMode} onChange={(k) => { setStartMode(k); if (k === 'now') setStartDate(null); }} />
            {startMode === 'date' ? (
              <View style={{ marginTop: spacing.md }}><DateStrip days={days} value={startDate} onChange={setStartDate} /></View>
            ) : null}
          </FormCard>

          {/* ── Weekly schedule ── */}
          <FormCard icon="clock" title={t('teacher.slots_section')} hint={t('teacher.slots_hint')} tint={colors.accent}
            action={(
              <TouchableOpacity onPress={addSlot} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.full, backgroundColor: colors.accentLight }}>
                <Icon name="add" size={16} color={colors.onAccent} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onAccent }}>{t('teacher.add_day')}</Text>
              </TouchableOpacity>
            )}>
            {slots.length === 0 ? (
              <TouchableOpacity onPress={addSlot} activeOpacity={0.85} style={{ alignItems: 'center', paddingVertical: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong }}>
                <Icon name="calendar" size={28} color={colors.textTertiary} outline />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm }}>{t('teacher.add_day')}</Text>
              </TouchableOpacity>
            ) : (
              slots.map((row, i) => {
                const bad = TIME_RE.test(row.start_time) && TIME_RE.test(row.end_time) && row.end_time <= row.start_time;
                return (
                  <View key={i} style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1, borderColor: bad ? colors.danger : colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                      <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{t('form_ui.slot_n', { n: formatNumber(i + 1) })}</Text>
                      <TouchableOpacity onPress={() => removeSlot(i)} hitSlop={8} accessibilityLabel={t('form_ui.remove')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon name="trash" size={15} color={colors.danger} />
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.danger }}>{t('form_ui.remove')}</Text>
                      </TouchableOpacity>
                    </View>
                    <DayPicker value={row.day_of_week} onChange={(d) => setSlot(i, { day_of_week: d })} tint={colors.accent} />
                    <View style={{ marginTop: spacing.sm }}>
                      <TimeRangeRow>
                        <View style={{ flex: 1 }}><TimePicker value={row.start_time || null} onChange={(v) => setSlot(i, { start_time: v })} /></View>
                        <Text style={{ fontFamily: fonts.bold, color: colors.textTertiary }}>–</Text>
                        <View style={{ flex: 1 }}><TimePicker value={row.end_time || null} onChange={(v) => setSlot(i, { end_time: v })} invalid={bad} /></View>
                      </TimeRangeRow>
                    </View>
                  </View>
                );
              })
            )}
          </FormCard>

          {/* ── Billing (required) ── */}
          <FormCard icon="money" title={t('teacher.billing_section')} required tint={colors.success}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Field label={t('teacher.cycle_sessions')} required first><NumberInput value={cycleSessions} onChangeText={setCycleSessions} placeholder="8" /></Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t('teacher.cycle_price')} required first><NumberInput value={cyclePrice} onChangeText={setCyclePrice} decimals placeholder="300" suffix={t('teacher.egp')} /></Field>
              </View>
            </View>
            {perSession ? <Banner tone="success" icon="money" text={t('teacher.per_session_hint', { price: perSession })} style={{ marginTop: spacing.md, marginBottom: 0 }} /> : null}

            <SwitchRow title={t('teacher.booklet_price')} value={hasBooklet} onChange={(v) => { setHasBooklet(v); if (!v) setBookletPrice(''); }} />
            {hasBooklet ? <View style={{ marginTop: spacing.sm }}><NumberInput value={bookletPrice} onChangeText={setBookletPrice} decimals placeholder={t('teacher.egp')} suffix={t('teacher.egp')} /></View> : null}

            <SwitchRow title={t('teacher.booking_price')} hint={bookletIsDownPayment ? t('teacher.booking_is_booklet') : undefined}
              value={hasBooking && !bookletIsDownPayment} disabled={bookletIsDownPayment} onChange={(v) => { setHasBooking(v); if (!v) setBookingPrice(''); }} />
            {hasBooking && !bookletIsDownPayment ? <View style={{ marginTop: spacing.sm }}><NumberInput value={bookingPrice} onChangeText={setBookingPrice} decimals placeholder={t('teacher.egp')} suffix={t('teacher.egp')} /></View> : null}
            {explainerDue ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.brand, marginTop: spacing.sm }}>{t('onboarding.price_hint')}</Text> : null}
          </FormCard>

          {/* ── Attendance & details ── */}
          <FormCard icon="settings" title={t('teacher.section_details')}>
            <Field label={t('teacher.radius_label')} first hint={showExplainer ? t('onboarding.geofence_hint') : undefined}>
              <Stepper value={radius_} min={5} max={50} step={5} onChange={setRadius} suffix={t('teacher.meters')} />
            </Field>
            <SwitchRow title={t('teacher.allow_swap_label')} hint={t('teacher.allow_swap_hint')} value={allowSwap} onChange={setAllowSwap} />
            <Field label={t('teacher.capacity')} hint={t('form_ui.optional')}>
              <NumberInput value={capacity} onChangeText={setCapacity} placeholder={t('teacher.optional')} />
            </Field>
            <Field label={t('teacher.description')} hint={t('form_ui.optional')}>
              <Input value={description} onChangeText={setDescription} placeholder={t('teacher.optional')} multiline />
            </Field>
          </FormCard>

          <Button title={t('teacher.create_course')} onPress={submit} loading={create.isPending} disabled={!canSubmit} variant="primary" />
        </>
      ) : null}
    </FormScreen>
  );
}
