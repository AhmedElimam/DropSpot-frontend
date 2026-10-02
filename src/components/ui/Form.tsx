import { SheetModal } from '@/components/ui/SheetModal';
import { memo, useMemo, useState, type ReactNode } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, ActivityIndicator, KeyboardAvoidingView, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, gradients } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber, formatDayDate } from '@/utils/format';
import { DAY_SHORT, WEEK_ORDER, dayKey } from '@/utils/sessionDays';

/**
 * The form kit behind every "create / edit" screen of the schedule group (courses, slots,
 * venues, exams, pauses, merges, Ramadan hours, revisions — founder 2026-10-02: "doesn't
 * look pretty to the eye at all"). One compact ink header, one card shape with a coloured
 * icon chip, one input, one chip, one day picker, one date picker. Screens keep their
 * logic and lose their private copies of all of this.
 */

// ---------------------------------------------------------------------------------------
// Screen frame
// ---------------------------------------------------------------------------------------

export function FormScreen({
  title, subtitle, right, children, loading = false, scroll = true, contentStyle,
}: {
  title: string;
  subtitle?: string | null;
  /** Something for the end of the title line (an «+» or a count pill). */
  right?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}
            style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="forward" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: '#fff' }} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.75)' }} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      </LinearGradient>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : scroll ? (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag"
            contentContainerStyle={[{ padding: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }, contentStyle]}>
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

/** A small header button: accent («+») or translucent. */
export function HeaderAction({ icon, label, onPress, tone = 'accent', accessibilityLabel }: {
  icon: IconName; label?: string; onPress: () => void; tone?: 'accent' | 'glass'; accessibilityLabel?: string;
}) {
  const accent = tone === 'accent';
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, minWidth: 36, paddingHorizontal: label ? 10 : 0, justifyContent: 'center', borderRadius: 12, backgroundColor: accent ? colors.accent : 'rgba(255,255,255,0.14)' }}>
      <Icon name={icon} size={label ? 17 : 20} color={accent ? colors.onAccent : '#fff'} />
      {label ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: accent ? colors.onAccent : '#fff' }}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

/** A count pill for the title line. */
export function HeaderCount({ n }: { n: number }) {
  return (
    <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{formatNumber(n)}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------
// Cards and fields
// ---------------------------------------------------------------------------------------

export function FormCard({ icon, title, hint, required, action, tint = colors.brand, children, style }: {
  icon: IconName; title: string; hint?: string; required?: boolean; action?: ReactNode; tint?: string; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: tint, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name={icon} size={19} color={tint === colors.accent ? colors.onAccent : '#fff'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>
            {title}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}
          </Text>
          {hint ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 1 }}>{hint}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Field({ label, required, hint, first, children }: { label: string; required?: boolean; hint?: string; first?: boolean; children: ReactNode }) {
  return (
    <View style={{ marginTop: first ? 0 : spacing.md }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>
        {label}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      {children}
      {hint ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: colors.textTertiary, marginTop: 4 }}>{hint}</Text> : null}
    </View>
  );
}

export const inputStyle = {
  backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
  paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const,
};

export function Input({ invalid, multiline, style, center, ...rest }: TextInputProps & { invalid?: boolean; center?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={colors.textTertiary}
      multiline={multiline}
      {...rest}
      style={[
        inputStyle,
        multiline ? { height: undefined, minHeight: 90, paddingTop: spacing.md, paddingBottom: spacing.md, textAlignVertical: 'top' as const } : null,
        center ? { textAlign: 'center' as const } : null,
        invalid ? { borderColor: colors.danger } : null,
        style,
      ]}
    />
  );
}

/** A `TextInput` for a number: digits only (Arabic-Indic accepted), optional decimals. */
export function NumberInput({ value, onChangeText, decimals = false, suffix, ...rest }: Omit<TextInputProps, 'value' | 'onChangeText'> & { value: string; onChangeText: (v: string) => void; decimals?: boolean; suffix?: string }) {
  const clean = (v: string) => {
    const latin = v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace('٫', '.');
    return decimals ? latin.replace(/[^0-9.]/g, '') : latin.replace(/[^0-9]/g, '');
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Input {...rest} value={value} onChangeText={(v) => onChangeText(clean(v))} keyboardType={decimals ? 'decimal-pad' : 'number-pad'} center style={{ flex: 1 }} />
      {suffix ? <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginStart: spacing.sm }}>{suffix}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------
// Choices
// ---------------------------------------------------------------------------------------

export type ChipOption<K extends string | number> = { key: K; label: string; icon?: IconName };

/** Single-select pills. `fill` makes them share the row equally (2–4 options). */
export function Chips<K extends string | number>({ options, value, onChange, fill = false, tint = colors.brand }: {
  options: ChipOption<K>[]; value: K | null; onChange: (k: K) => void; fill?: boolean; tint?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: fill ? 'nowrap' : 'wrap', gap: spacing.sm }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <TouchableOpacity key={String(o.key)} onPress={() => onChange(o.key)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={{ flex: fill ? 1 : undefined, height: 40, paddingHorizontal: fill ? 6 : spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: fill ? radius.md : radius.full, backgroundColor: on ? tint : colors.surfaceSunken, borderWidth: 1, borderColor: on ? tint : colors.border }}>
            {o.icon ? <Icon name={o.icon} size={15} color={on ? '#fff' : colors.textSecondary} /> : null}
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? '#fff' : colors.textSecondary }} numberOfLines={1}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** The week as seven equal tiles, Saturday first (JS getDay values in / out). */
export function DayPicker({ value, onChange, tint = colors.brand }: { value: number | null; onChange: (day: number) => void; tint?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {WEEK_ORDER.map((d) => {
        const on = d === value;
        return (
          <TouchableOpacity key={d} onPress={() => onChange(d)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={{ flex: 1, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? tint : colors.surfaceSunken, borderWidth: 1, borderColor: on ? tint : colors.border }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: on ? '#fff' : colors.textSecondary }} numberOfLines={1} adjustsFontSizeToFit>{DAY_SHORT[d]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function Stepper({ value, min, max, step, onChange, suffix }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix?: string }) {
  const btn = (label: string, onPress: () => void, disabled: boolean) => (
    <TouchableOpacity onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={{ width: 48, height: 48, borderRadius: radius.lg, backgroundColor: disabled ? colors.surfaceSunken : colors.brandTint, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 28, color: disabled ? colors.textTertiary : colors.brand }}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      {btn('−', () => onChange(Math.max(min, value - step)), value <= min)}
      <View style={{ flex: 1, height: 48, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{formatNumber(value)}{suffix ? ` ${suffix}` : ''}</Text>
      </View>
      {btn('+', () => onChange(Math.min(max, value + step)), value >= max)}
    </View>
  );
}

export function SwitchRow({ title, hint, value, onChange, disabled, first }: { title: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; first?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: first ? 0 : spacing.md, opacity: disabled ? 0.6 : 1 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{title}</Text>
        {hint ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.brand }} />
    </View>
  );
}

/** A selectable row (radio or checkbox) for lists of courses / slots. */
export const OptionRow = memo(function OptionRow({ title, sub, selected, mode = 'radio', onPress, leading, trailing, disabled }: {
  title: string; sub?: string | null; selected: boolean; mode?: 'radio' | 'check'; onPress: () => void; leading?: ReactNode; trailing?: ReactNode; disabled?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85} accessibilityRole={mode === 'check' ? 'checkbox' : 'radio'} accessibilityState={{ selected, checked: selected }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: selected ? colors.brand : colors.border, backgroundColor: selected ? colors.brandTint : colors.surface, marginBottom: spacing.sm, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ width: 24, height: 24, borderRadius: mode === 'radio' ? 12 : 7, borderWidth: 2, borderColor: selected ? colors.brand : colors.borderStrong, backgroundColor: selected && mode === 'check' ? colors.brand : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
        {selected ? (mode === 'check' ? <Icon name="success" size={15} color="#fff" /> : <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand }} />) : null}
      </View>
      {leading}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: selected ? colors.brand : colors.textPrimary }} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {trailing}
    </TouchableOpacity>
  );
});

const TONES = {
  info: { bg: colors.brandTint, fg: colors.brand, icon: 'info' as IconName },
  warn: { bg: colors.warningLight, fg: colors.warningText, icon: 'warning' as IconName },
  danger: { bg: colors.dangerLight, fg: colors.dangerText, icon: 'warning' as IconName },
  success: { bg: colors.successLight, fg: colors.successText, icon: 'success' as IconName },
};

export function Banner({ tone = 'info', icon, text, children, style }: { tone?: keyof typeof TONES; icon?: IconName; text?: string; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = TONES[tone];
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: c.bg, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }, style]}>
      <Icon name={icon ?? c.icon} size={18} color={c.fg} />
      <View style={{ flex: 1 }}>
        {text ? <Text style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: c.fg }}>{text}</Text> : null}
        {children}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------

/** Local YYYY-MM-DD (never toISOString — that shifts by the UTC offset). */
export function toIsoDate(d: Date): string {
  return dayKey(d);
}

export function upcomingDays(count: number): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  const base = new Date(); base.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i);
    out.push({ iso: toIsoDate(d), label: d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' }) });
  }
  return out;
}

function parseIso(iso: string | null): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A horizontal strip of the coming days — for "which day" when it is soon. */
export function DateStrip({ days, value, onChange }: { days: { iso: string; label: string }[]; value: string | null; onChange: (iso: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
      {days.map((d) => {
        const on = value === d.iso;
        return (
          <TouchableOpacity key={d.iso} onPress={() => onChange(d.iso)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={{ paddingHorizontal: spacing.md, height: 40, justifyContent: 'center', borderRadius: radius.full, backgroundColor: on ? colors.brand : colors.surfaceSunken, borderWidth: 1, borderColor: on ? colors.brand : colors.border }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? '#fff' : colors.textSecondary }}>{d.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const MONTH_FMT = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' });

/**
 * A tap-to-pick date (YYYY-MM-DD in, YYYY-MM-DD out) with a Saturday-first month grid.
 * Replaces the typed `YYYY-MM-DD` boxes on the pause / Ramadan / revision forms.
 */
export function DateField({ value, onChange, placeholder, minIso, invalid }: { value: string | null; onChange: (iso: string) => void; placeholder?: string; minIso?: string | null; invalid?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const picked = parseIso(value);
  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.8} accessibilityRole="button"
        style={[inputStyle, { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, invalid ? { borderColor: colors.danger } : null]}>
        <Icon name="calendar" size={18} color={picked ? colors.brand : colors.textTertiary} />
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: picked ? colors.textPrimary : colors.textTertiary }} numberOfLines={1}>
          {picked ? formatDayDate(picked) : (placeholder ?? t('form_ui.pick_date'))}
        </Text>
        <Icon name="down" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
      {open ? <DateSheet value={picked} minIso={minIso ?? null} onPick={(d) => { onChange(toIsoDate(d)); setOpen(false); }} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function DateSheet({ value, minIso, onPick, onClose }: { value: Date | null; minIso: string | null; onPick: (d: Date) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [month, setMonth] = useState(() => { const b = value ?? today; return new Date(b.getFullYear(), b.getMonth(), 1); });
  const cells = useMemo(() => {
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const lead = WEEK_ORDER.indexOf(month.getDay());
    const out: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= last; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);
  const min = parseIso(minIso);
  const selectedKey = value ? dayKey(value) : null;
  const todayKey = dayKey(today);
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const arrow = (icon: IconName, onPress: () => void, label: string) => (
    <TouchableOpacity onPress={onPress} hitSlop={8} accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={colors.textPrimary} />
    </TouchableOpacity>
  );
  return (
    <SheetModal visible onClose={onClose} style={{ backgroundColor: colors.background, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {arrow('forward', () => shift(-1), t('session_ui.prev_month'))}
            <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{MONTH_FMT.format(month)}</Text>
            {arrow('back', () => shift(1), t('session_ui.next_month'))}
          </View>
          <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
            {WEEK_ORDER.map((d) => <Text key={d} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>{DAY_SHORT[d]}</Text>)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs }}>
            {cells.map((d, i) => {
              if (!d) return <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 46 }} />;
              const k = dayKey(d);
              const on = k === selectedKey;
              const isToday = k === todayKey;
              const disabled = !!min && d < min;
              return (
                <View key={k} style={{ width: `${100 / 7}%`, height: 46, padding: 2 }}>
                  <TouchableOpacity onPress={() => onPick(d)} disabled={disabled} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: on, disabled }}
                    style={{ flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.brand : 'transparent', borderWidth: isToday && !on ? 1.5 : 0, borderColor: colors.accent, opacity: disabled ? 0.3 : 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: on ? '#fff' : colors.textPrimary }}>{formatNumber(d.getDate())}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
          <TouchableOpacity onPress={() => onPick(today)} activeOpacity={0.85}
            style={{ marginTop: spacing.lg, minHeight: 46, borderRadius: radius.lg, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
            <Icon name="calendar" size={18} color={colors.onAccent} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onAccent }}>{t('teacher.today')}</Text>
          </TouchableOpacity>
    </SheetModal>
  );
}

/** A slot's time range as «٤:٠٠ م – ٦:٠٠ م», from two TimePickers side by side. */
export function TimeRangeRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>{children}</View>;
}
