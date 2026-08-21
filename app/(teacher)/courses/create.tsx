import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Switch } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useCourseFormOptions, useCreateCourse } from '@/hooks/useCourses';
import { useTeacherOnboarding, useMarkOnboardingStep } from '@/hooks/useTeacherOnboarding';

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

type Slot = { day_of_week: number; start_time: string; end_time: string };

/** Local YYYY-MM-DD (never toISOString — that shifts by the UTC offset). */
function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** The next `count` calendar days starting today, as {iso, label} for the picker strip. */
function upcomingDays(count: number): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push({ iso: toIsoDate(d), label: d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' }) });
  }
  return out;
}

/**
 * Create a course — full parity with the web /courses/create form: name, grade,
 * term, code, capacity, radius, description, and weekly slots. Teacher-only
 * (the API rejects assistants). On success, jumps to the new course's settings.
 */
export default function CourseCreateScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
  const [termId, setTermId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [capacity, setCapacity] = useState('');
  const [radius_, setRadius] = useState(20);
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  // "When do you want to start" — now (mint this week's remaining days immediately) or
  // a specific date (holds generation until then). null date while mode is 'now'.
  const [startMode, setStartMode] = useState<'now' | 'date'>('now');
  const [startDate, setStartDate] = useState<string | null>(null);
  const days = useRef(upcomingDays(45)).current;
  // Pricing (empty = disabled/none) — mirrors the web create form.
  const [cycleSessions, setCycleSessions] = useState('8');
  const [cyclePrice, setCyclePrice] = useState('');
  const [bookletPrice, setBookletPrice] = useState('');
  const [bookingPrice, setBookingPrice] = useState('');
  // Explicit on/off for the two optional charges (mirrors the web toggles). Off =
  // the price field is hidden and the course is saved with no such charge.
  const [hasBooklet, setHasBooklet] = useState(false);
  const [hasBooking, setHasBooking] = useState(false);

  const perSession = (() => {
    const p = parseFloat(cyclePrice);
    const n = parseInt(cycleSessions, 10);
    return p > 0 && n > 0 ? (p / n).toFixed(2) : null;
  })();

  useEffect(() => {
    if (options && termId === null) {
      setTermId(options.current_term_id);
      setRadius(options.default_radius ?? 20);
    }
  }, [options, termId]);

  // Onboarding Step 2: show the explainer once when due, and mark course_form seen.
  // Kept visible for the whole visit even after the state flips (local flag).
  const explainerDue = !!onboarding?.active && !onboarding.steps.course_form;
  useEffect(() => {
    if (explainerDue && !explainerMarked.current) {
      explainerMarked.current = true;
      setShowExplainer(true);
      markStep.mutate('course_form');
    }
  }, [explainerDue]);

  const slotsValid = slots.every((s) => TIME_RE.test(s.start_time) && TIME_RE.test(s.end_time) && s.end_time > s.start_time);
  // Session-based billing (الفوترة حسب عدد الحصص) is required — a course can't be
  // created without a cycle size and a positive price.
  const billingValid = parseFloat(cyclePrice) >= 1 && parseInt(cycleSessions, 10) >= 1;
  const startValid = startMode === 'now' || !!startDate;
  const canSubmit = name.trim().length > 0 && !!gradeId && !!termId && slotsValid && billingValid && startValid && !create.isPending;

  const addSlot = () => setSlots((s) => [...s, { day_of_week: 0, start_time: '16:00', end_time: '18:00' }]);
  const removeSlot = (i: number) => setSlots((s) => s.filter((_, idx) => idx !== i));
  const setSlot = (i: number, patch: Partial<Slot>) => setSlots((s) => s.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submit = () => {
    if (!canSubmit || !gradeId || !termId) return;
    create.mutate(
      {
        name: name.trim(),
        grade_id: Number(gradeId),
        academic_session_id: Number(termId),
        code: code.trim() || undefined,
        capacity: capacity.trim() ? Number(capacity.trim()) : undefined,
        radius_horizontal_meters: radius_,
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
          // Onboarding Step 3: a popup showing the auto-generated sessions, then to
          // the course detail (slots + upcoming counts).
          const sessionsDue = !!onboarding?.active && !onboarding.steps.sessions;
          if (sessionsDue) markStep.mutate('sessions');
          const title = sessionsDue ? t('onboarding.sessions_title') : t('teacher.create_course');
          const body = sessionsDue
            ? (res.generated > 0 ? t('onboarding.sessions_body', { count: res.generated }) : t('onboarding.sessions_body_none'))
            : (res.term_ended ? t('teacher.create_term_ended') : t('teacher.create_done', { count: res.generated }));
          const okLabel = sessionsDue ? t('onboarding.view_course') : t('common.ok');
          Alert.alert(title, body, [
            { text: okLabel, onPress: () => router.replace(`/(teacher)/courses/${res.course.id}` as Href) },
          ]);
        },
        onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.create_failed')),
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.create_course')}</Text>
      </View>

      {isLoading || !options ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
          {/* Onboarding Step 2: contextual explainer of this screen (geofence emphasized). */}
          {showExplainer && (
            <View style={{ backgroundColor: colors.brandTint, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand, textAlign: 'right' }}>{t('onboarding.course_form_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.textSecondary, textAlign: 'right', marginTop: 4 }}>{t('onboarding.course_form_body')}</Text>
            </View>
          )}

          {/* Name */}
          <FieldLabel required>{t('teacher.course_name')}</FieldLabel>
          <TextInput value={name} onChangeText={setName} placeholder={t('teacher.course_name_ph')} placeholderTextColor={colors.textTertiary} style={input} />

          {/* Grade */}
          <FieldLabel required>{t('teacher.grade')}</FieldLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {options.grades.map((g) => (
              <Pill key={g.id} label={g.name} active={g.id === gradeId} onPress={() => setGradeId(g.id)} />
            ))}
          </View>

          {/* Term */}
          <FieldLabel required>{t('teacher.term')}</FieldLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {options.terms.map((tm) => (
              <Pill key={tm.id} label={tm.name + (tm.ended ? ` — ${t('teacher.term_ended_tag')}` : '')} active={tm.id === termId} onPress={() => setTermId(tm.id)} />
            ))}
          </View>

          {/* When do you want to start — now, or a specific date */}
          <FieldLabel>{t('teacher.start_when')}</FieldLabel>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pill label={t('teacher.start_now')} active={startMode === 'now'} onPress={() => { setStartMode('now'); setStartDate(null); }} />
            <Pill label={t('teacher.start_on_date')} active={startMode === 'date'} onPress={() => setStartMode('date')} />
          </View>
          {startMode === 'date' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: spacing.sm }}>
              {days.map((d) => (
                <TouchableOpacity
                  key={d.iso}
                  onPress={() => setStartDate(d.iso)}
                  style={{ paddingHorizontal: spacing.md, height: 40, justifyContent: 'center', borderRadius: radius.full, backgroundColor: startDate === d.iso ? colors.brand : colors.surface, borderWidth: 1, borderColor: startDate === d.iso ? colors.brand : colors.border }}
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: startDate === d.iso ? '#fff' : colors.textSecondary }}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, textAlign: 'right', marginTop: 4 }}>{t('teacher.start_hint')}</Text>

          {/* Code + capacity */}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>{t('teacher.course_code')}</FieldLabel>
              <TextInput value={code} onChangeText={setCode} placeholder={t('teacher.auto')} placeholderTextColor={colors.textTertiary} autoCapitalize="characters" style={input} />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel>{t('teacher.capacity')}</FieldLabel>
              <TextInput value={capacity} onChangeText={setCapacity} placeholder={t('teacher.optional')} placeholderTextColor={colors.textTertiary} keyboardType="numeric" style={input} />
            </View>
          </View>

          {/* Radius */}
          <FieldLabel>{t('teacher.radius_label')}</FieldLabel>
          <Stepper value={radius_} min={10} max={50} step={5} onChange={setRadius} suffix={t('teacher.meters')} />
          {showExplainer && (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.brand, textAlign: 'right', marginTop: 4 }}>{t('onboarding.geofence_hint')}</Text>
          )}

          {/* Description */}
          <FieldLabel>{t('teacher.description')}</FieldLabel>
          <TextInput value={description} onChangeText={setDescription} placeholder={t('teacher.optional')} placeholderTextColor={colors.textTertiary} multiline style={[input, { minHeight: 70, textAlignVertical: 'top' }]} />

          {/* Weekly slots */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('teacher.slots_section')}</Text>
            <TouchableOpacity onPress={addSlot} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.full, backgroundColor: colors.brandTint }}>
              <Icon name="add" size={16} color={colors.brand} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.add_day')}</Text>
            </TouchableOpacity>
          </View>
          {slots.length === 0 ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('teacher.slots_hint')}</Text>
          ) : (
            slots.map((row, i) => (
              <View key={i} style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{t('teacher.day')} {i + 1}</Text>
                  <TouchableOpacity onPress={() => removeSlot(i)}><Icon name="trash" size={16} color={colors.danger} /></TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 6 }}>
                  {DAYS_AR.map((d, di) => (
                    <TouchableOpacity key={di} onPress={() => setSlot(i, { day_of_week: di })} style={{ paddingHorizontal: spacing.md, height: 36, justifyContent: 'center', borderRadius: radius.full, backgroundColor: row.day_of_week === di ? colors.brand : colors.surface, borderWidth: 1, borderColor: row.day_of_week === di ? colors.brand : colors.border }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: row.day_of_week === di ? '#fff' : colors.textSecondary }}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 6 }}>
                  <TimeField value={row.start_time} onChange={(v) => setSlot(i, { start_time: v })} />
                  <TimeField value={row.end_time} onChange={(v) => setSlot(i, { end_time: v })} />
                </View>
              </View>
            ))
          )}

          {/* Session-based billing — set at creation so the course works immediately */}
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, marginTop: spacing.xl }}>
            {t('teacher.billing_section')} <Text style={{ color: colors.danger }}>*</Text>
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <FieldLabel required>{t('teacher.cycle_sessions')}</FieldLabel>
              <TextInput value={cycleSessions} onChangeText={setCycleSessions} placeholder="8" placeholderTextColor={colors.textTertiary} keyboardType="numeric" style={input} />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel required>{t('teacher.cycle_price')}</FieldLabel>
              <TextInput value={cyclePrice} onChangeText={setCyclePrice} placeholder="مثال: 300" placeholderTextColor={colors.textTertiary} keyboardType="numeric" style={input} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <FieldLabel>{t('teacher.booklet_price')}</FieldLabel>
                <Switch value={hasBooklet} onValueChange={(v) => { setHasBooklet(v); if (!v) setBookletPrice(''); }} trackColor={{ true: colors.brand }} />
              </View>
              {hasBooklet ? (
                <TextInput value={bookletPrice} onChangeText={setBookletPrice} placeholder={t('teacher.egp')} placeholderTextColor={colors.textTertiary} keyboardType="numeric" style={input} />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <FieldLabel>{t('teacher.booking_price')}</FieldLabel>
                <Switch value={hasBooking && !bookletIsDownPayment} disabled={bookletIsDownPayment} onValueChange={(v) => { setHasBooking(v); if (!v) setBookingPrice(''); }} trackColor={{ true: colors.brand }} />
              </View>
              {bookletIsDownPayment ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{t('teacher.booking_is_booklet')}</Text>
              ) : hasBooking ? (
                <TextInput value={bookingPrice} onChangeText={setBookingPrice} placeholder={t('teacher.egp')} placeholderTextColor={colors.textTertiary} keyboardType="numeric" style={input} />
              ) : null}
            </View>
          </View>
          {perSession ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm }}>{t('teacher.per_session_hint', { price: perSession })}</Text>
          ) : null}
          {explainerDue ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.brand, textAlign: 'right', marginTop: spacing.sm }}>{t('onboarding.price_hint')}</Text>
          ) : null}

          <View style={{ marginTop: spacing.xl }}>
            <Button title={t('teacher.create_course')} onPress={submit} loading={create.isPending} disabled={!canSubmit} variant="primary" />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm }}>
      {children}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}
    </Text>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: spacing.lg, minHeight: 40, justifyContent: 'center', borderRadius: radius.full, backgroundColor: active ? colors.brand : colors.surface, borderWidth: 1, borderColor: active ? colors.brand : colors.border }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: active ? '#fff' : colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  );
}

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const valid = TIME_RE.test(value);
  return (
    <TextInput value={value} onChangeText={onChange} placeholder="16:00" placeholderTextColor={colors.textTertiary} style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: valid ? colors.border : colors.danger, borderRadius: radius.md, height: 44, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'center' }} />
  );
}

function Stepper({ value, min, max, step, onChange, suffix }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))} style={stepBtn}><Text style={stepTxt}>−</Text></TouchableOpacity>
      <View style={{ minWidth: 90, alignItems: 'center' }}><Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{value}{suffix ? ` ${suffix}` : ''}</Text></View>
      <TouchableOpacity onPress={() => onChange(Math.min(max, value + step))} style={stepBtn}><Text style={stepTxt}>+</Text></TouchableOpacity>
    </View>
  );
}

const input = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const };
const stepBtn = { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' } as const;
const stepTxt = { fontFamily: fonts.bold, fontSize: 24, color: colors.brand } as const;
