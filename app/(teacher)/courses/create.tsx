import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Switch, KeyboardAvoidingView, Modal } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { TimePicker } from '@/components/ui/TimePicker';
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
  const [allowSwap, setAllowSwap] = useState(true);
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
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.create_course')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>{t('teacher.create_course_sub')}</Text>
        </View>
      </View>

      {isLoading || !options ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Onboarding Step 2: contextual explainer of this screen (geofence emphasized). */}
          {showExplainer && (
            <View style={{ backgroundColor: colors.brandTint, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand, textAlign: 'right' }}>{t('onboarding.course_form_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.textSecondary, textAlign: 'right', marginTop: 4 }}>{t('onboarding.course_form_body')}</Text>
            </View>
          )}

          {/* ── Basics: name, grade, term ── */}
          <Section icon="book" title={t('teacher.section_basics')}>
            <FieldLabel required first>{t('teacher.course_name')}</FieldLabel>
            <TextInput value={name} onChangeText={setName} placeholder={t('teacher.course_name_ph')} placeholderTextColor={colors.textTertiary} style={input} />

            <FieldLabel required>{t('teacher.grade')}</FieldLabel>
            <SelectField
              value={gradeId}
              options={options.grades}
              placeholder={t('teacher.grade_ph')}
              onSelect={setGradeId}
            />

            <FieldLabel required>{t('teacher.term')}</FieldLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {options.terms.map((tm) => (
                <Pill key={tm.id} label={tm.name + (tm.ended ? ` — ${t('teacher.term_ended_tag')}` : '')} active={tm.id === termId} onPress={() => setTermId(tm.id)} />
              ))}
            </View>
          </Section>

          {/* ── Start: now or a specific date ── */}
          <Section icon="calendar" title={t('teacher.start_when')}>
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
                    style={{ paddingHorizontal: spacing.md, height: 40, justifyContent: 'center', borderRadius: radius.full, backgroundColor: startDate === d.iso ? colors.brand : colors.surfaceSunken, borderWidth: 1, borderColor: startDate === d.iso ? colors.brand : colors.border }}
                  >
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: startDate === d.iso ? '#fff' : colors.textSecondary }}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, textAlign: 'right', marginTop: spacing.sm }}>{t('teacher.start_hint')}</Text>
          </Section>

          {/* ── Details: code, capacity, radius, description ── */}
          <Section icon="settings" title={t('teacher.section_details')}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <FieldLabel first>{t('teacher.course_code')}</FieldLabel>
                <TextInput value={code} onChangeText={setCode} placeholder={t('teacher.auto')} placeholderTextColor={colors.textTertiary} autoCapitalize="characters" style={input} />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel first>{t('teacher.capacity')}</FieldLabel>
                <TextInput value={capacity} onChangeText={setCapacity} placeholder={t('teacher.optional')} placeholderTextColor={colors.textTertiary} keyboardType="numeric" style={input} />
              </View>
            </View>

            <FieldLabel>{t('teacher.radius_label')}</FieldLabel>
            <Stepper value={radius_} min={5} max={50} step={5} onChange={setRadius} suffix={t('teacher.meters')} />
            {showExplainer && (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.brand, textAlign: 'right', marginTop: 4 }}>{t('onboarding.geofence_hint')}</Text>
            )}

            <FieldLabel>{t('teacher.description')}</FieldLabel>
            <TextInput value={description} onChangeText={setDescription} placeholder={t('teacher.optional')} placeholderTextColor={colors.textTertiary} multiline style={textarea} />
          </Section>

          {/* ── Weekly schedule ── */}
          <Section
            icon="clock"
            title={t('teacher.slots_section')}
            action={(
              <TouchableOpacity onPress={addSlot} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.full, backgroundColor: colors.brandTint }}>
                <Icon name="add" size={16} color={colors.brand} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.add_day')}</Text>
              </TouchableOpacity>
            )}
          >
            {slots.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                <Icon name="calendar" size={26} color={colors.textTertiary} outline />
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>{t('teacher.slots_hint')}</Text>
              </View>
            ) : (
              slots.map((row, i) => (
                <View key={i} style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{t('teacher.day')} {i + 1}</Text>
                    <TouchableOpacity onPress={() => removeSlot(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Icon name="trash" size={16} color={colors.danger} /></TouchableOpacity>
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
          </Section>

          {/* ── Billing (required) ── */}
          <Section icon="money" title={t('teacher.billing_section')} required>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <FieldLabel required first>{t('teacher.cycle_sessions')}</FieldLabel>
                <TextInput value={cycleSessions} onChangeText={setCycleSessions} placeholder="8" placeholderTextColor={colors.textTertiary} keyboardType="numeric" style={input} />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel required first>{t('teacher.cycle_price')}</FieldLabel>
                <TextInput value={cyclePrice} onChangeText={setCyclePrice} placeholder="مثال: 300" placeholderTextColor={colors.textTertiary} keyboardType="numeric" style={input} />
              </View>
            </View>
            {perSession ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm }}>{t('teacher.per_session_hint', { price: perSession })}</Text>
            ) : null}

            {/* Session-swap permission */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
              <View style={{ flex: 1, paddingEnd: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('teacher.allow_swap_label')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('teacher.allow_swap_hint')}</Text>
              </View>
              <Switch value={allowSwap} onValueChange={setAllowSwap} trackColor={{ true: colors.brand }} />
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <FieldLabel first>{t('teacher.booklet_price')}</FieldLabel>
                  <Switch value={hasBooklet} onValueChange={(v) => { setHasBooklet(v); if (!v) setBookletPrice(''); }} trackColor={{ true: colors.brand }} />
                </View>
                {hasBooklet ? (
                  <TextInput value={bookletPrice} onChangeText={setBookletPrice} placeholder={t('teacher.egp')} placeholderTextColor={colors.textTertiary} keyboardType="numeric" style={input} />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <FieldLabel first>{t('teacher.booking_price')}</FieldLabel>
                  <Switch value={hasBooking && !bookletIsDownPayment} disabled={bookletIsDownPayment} onValueChange={(v) => { setHasBooking(v); if (!v) setBookingPrice(''); }} trackColor={{ true: colors.brand }} />
                </View>
                {bookletIsDownPayment ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>{t('teacher.booking_is_booklet')}</Text>
                ) : hasBooking ? (
                  <TextInput value={bookingPrice} onChangeText={setBookingPrice} placeholder={t('teacher.egp')} placeholderTextColor={colors.textTertiary} keyboardType="numeric" style={input} />
                ) : null}
              </View>
            </View>
            {explainerDue ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.brand, textAlign: 'right', marginTop: spacing.sm }}>{t('onboarding.price_hint')}</Text>
            ) : null}
          </Section>

          <Button title={t('teacher.create_course')} onPress={submit} loading={create.isPending} disabled={!canSubmit} variant="primary" />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

/** A titled card that groups related fields — the backbone of the form's new layout. */
function Section({ icon, title, action, required, children }: { icon: IconName; title: string; action?: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <View style={cardStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
          <Icon name={icon} size={18} color={colors.brand} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>
          {title}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/** A tap-to-open dropdown select — cleaner than a wall of pills for long lists (e.g. year grades). */
function SelectField({ value, options, placeholder, onSelect }: { value: string | null; options: { id: string; name: string }[]; placeholder: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        style={[input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
      >
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: selected ? colors.textPrimary : colors.textTertiary }}>
          {selected ? selected.name : placeholder}
        </Text>
        <Icon name="down" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, maxHeight: '70%', overflow: 'hidden', ...shadows.lg }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {options.map((o) => {
                const sel = o.id === value;
                return (
                  <TouchableOpacity
                    key={o.id}
                    onPress={() => { onSelect(o.id); setOpen(false); }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: sel ? colors.brandTint : 'transparent' }}
                  >
                    <Text style={{ fontFamily: sel ? fonts.bold : fonts.medium, fontSize: 15, color: sel ? colors.brand : colors.textPrimary }}>{o.name}</Text>
                    {sel ? <Icon name="success" size={18} color={colors.brand} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function FieldLabel({ children, required, first }: { children: string; required?: boolean; first?: boolean }) {
  return (
    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginTop: first ? 0 : spacing.lg, marginBottom: spacing.sm }}>
      {children}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}
    </Text>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: spacing.lg, minHeight: 40, justifyContent: 'center', borderRadius: radius.full, backgroundColor: active ? colors.brand : colors.surfaceSunken, borderWidth: 1, borderColor: active ? colors.brand : colors.border }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: active ? '#fff' : colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  );
}

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // App-wide 12-hour time picker (stores 24h HH:mm for the backend). No free text.
  return (
    <View style={{ flex: 1 }}>
      <TimePicker value={value || null} onChange={onChange} invalid={!!value && !TIME_RE.test(value)} />
    </View>
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

const cardStyle = { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm } as const;
const input = { backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const };
// Multiline note: NO fixed height (the base `input` pins 48px, which clipped/overflowed
// longer text) — grows with content from a minHeight instead.
const textarea = { backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md, minHeight: 90, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const, textAlignVertical: 'top' as const };
const stepBtn = { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' } as const;
const stepTxt = { fontFamily: fonts.bold, fontSize: 24, color: colors.brand } as const;
