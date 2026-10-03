import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, control } from '@/theme/index';
import { getEnrollmentTerms, type BookingSecures, type EnrollmentTermsDefaults, type EnrollmentTermsInput } from '@/api/enrollmentTerms';

/**
 * «شروط التسجيل» — the ONE sheet every enrolling screen shows (the door, the card scan,
 * the phone invite, a booking request): where the class is in its month, which session
 * this student starts at, the دفعة and what it secures, what was paid, the booklet.
 *
 * Founder 2026-10-02: the same facts stated the same way on every door, so the billing
 * never depends on which door the student came through. The server does the arithmetic
 * (App\Services\EnrollmentTermsService); this only states facts and previews the cost.
 */

export interface TermsState {
  /** The session this student starts at; null = not chosen → the server infers the class's position. */
  joinsAt: number | null;
  /** null until the defaults load (then seeded from the teacher's requires_down_payment). */
  bookingOn: boolean | null;
  secures: BookingSecures | null;
  amount: string;
  paid: string;
  /** For a session-secured دفعة: how many sessions it buys. */
  sessions: string;
  bookletPaid: boolean;
  /** This month's fee was already paid before the teacher joined the system. */
  cyclePaid: boolean;
  /** Optional part of it (blank = the whole advance invoice). */
  cyclePaidAmount: string;
}

const EMPTY: TermsState = { joinsAt: null, bookingOn: null, secures: null, amount: '', paid: '', sessions: '', bookletPaid: false, cyclePaid: false, cyclePaidAmount: '' };

export interface EnrollmentTermsHandle {
  courseId: number | null;
  data: EnrollmentTermsDefaults | undefined;
  isLoading: boolean;
  state: TermsState;
  set: (patch: Partial<TermsState>) => void;
  /** The request keys, exactly as the server reads them. */
  payload: () => EnrollmentTermsInput;
  /** After one student is saved: keep the per-course answers (position, دفعة on/off, secures), drop the per-student money. */
  resetPerStudent: () => void;
  /** The effective "what the دفعة secures" (chosen, else the teacher's default). */
  securesEffective: BookingSecures | null;
  /** True when the paid figure exceeds the amount (blocks submit). */
  overpaid: boolean;
}

export function useEnrollmentTerms(courseId: number | null): EnrollmentTermsHandle {
  const q = useQuery({
    queryKey: ['enrollment-terms', courseId],
    queryFn: () => getEnrollmentTerms(courseId!),
    enabled: courseId != null,
    staleTime: 60_000,
  });
  const [state, setState] = useState<TermsState>(EMPTY);

  // A new course = a fresh statement; the teacher's defaults seed the switch once.
  useEffect(() => { setState(EMPTY); }, [courseId]);
  useEffect(() => {
    if (!q.data || q.data.course_id !== courseId) return;
    setState((s) => ({
      ...s,
      bookingOn: s.bookingOn ?? q.data!.booking.required,
      secures: s.secures ?? q.data!.booking.default_secures,
    }));
  }, [q.data, courseId]);

  const set = useCallback((patch: Partial<TermsState>) => setState((s) => ({ ...s, ...patch })), []);
  const securesEffective = state.secures ?? q.data?.booking.default_secures ?? null;
  const amountNum = Number(state.amount) || 0;
  const paidNum = Number(state.paid) || 0;
  const overpaid = amountNum > 0 && paidNum > amountNum;

  const payload = useCallback((): EnrollmentTermsInput => {
    const out: EnrollmentTermsInput = {};
    if (state.joinsAt != null) out.joins_at_session = state.joinsAt;
    if (state.bookingOn === false) {
      out.down_payment_amount = null; // stated: no دفعة for this student
    } else if (state.bookingOn === true) {
      if (securesEffective) out.booking_secures = securesEffective;
      if (state.amount.trim() !== '') {
        out.down_payment_amount = Number(state.amount);
        if (state.paid.trim() !== '') out.down_payment_paid = Number(state.paid);
      }
      if (securesEffective === 'session' && state.sessions.trim() !== '') out.sessions_remaining = Number(state.sessions);
    }
    if (q.data?.booklet.offered) out.booklet_paid = state.bookletPaid;
    if (state.cyclePaid) {
      out.cycle_paid = true;
      if (state.cyclePaidAmount.trim() !== '' && Number(state.cyclePaidAmount) > 0) out.cycle_paid_amount = Number(state.cyclePaidAmount);
    }
    return out;
  }, [state, securesEffective, q.data]);

  const resetPerStudent = useCallback(() => setState((s) => ({ ...s, amount: '', paid: '', sessions: '', bookletPaid: false, cyclePaid: false, cyclePaidAmount: '' })), []);

  return { courseId, data: q.data, isLoading: q.isLoading, state, set, payload, resetPerStudent, securesEffective, overpaid };
}

const SECURES: { key: BookingSecures; label: string }[] = [
  { key: 'session', label: 'الحصص' },
  { key: 'booklet', label: 'الملزمة' },
  { key: 'flat', label: 'حجز مبدئي' },
];

const money = (n: number) => `${Math.round(n * 100) / 100} ج.م`;

const label = () => ({ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs } as const);
const field = () => ({
  fontFamily: fonts.regular, fontSize: 16, minHeight: control.minHeight - 4,
  backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.borderStrong,
  paddingHorizontal: spacing.lg, paddingVertical: 12, color: colors.textPrimary, textAlign: 'right' as const,
});

/** One-line summary for the collapsed form («الحصة 6/8 · دفعة 100 (مدفوع 100) · ملزمة مدفوعة»). */
export function summarizeTerms(h: EnrollmentTermsHandle): string {
  const d = h.data;
  if (!d) return '';
  const parts: string[] = [];
  const pos = h.state.joinsAt ?? d.cycle.position;
  parts.push(`الحصة ${pos}/${d.cycle.threshold}`);
  if (h.state.bookingOn === false) parts.push('بدون دفعة');
  else if (h.state.bookingOn) {
    const amt = h.state.amount.trim() !== '' ? Number(h.state.amount) : null;
    parts.push(amt != null ? `دفعة ${money(amt)}${h.state.paid.trim() !== '' ? ` (مدفوع ${money(Number(h.state.paid))})` : ''}` : 'دفعة افتراضية');
  }
  if (d.booklet.offered) parts.push(h.state.bookletPaid ? 'ملزمة مدفوعة' : 'ملزمة غير مدفوعة');
  if (h.state.cyclePaid) parts.push(h.state.cyclePaidAmount.trim() !== '' ? `رسوم الشهر مدفوعة مسبقًا (${money(Number(h.state.cyclePaidAmount))})` : 'رسوم الشهر مدفوعة مسبقًا');
  return parts.join(' · ');
}

interface Props {
  terms: EnrollmentTermsHandle;
}

export function EnrollmentTermsSheet({ terms }: Props) {
  const d = terms.data;
  const s = terms.state;

  const chosen = s.joinsAt ?? d?.cycle.position ?? 1;
  const remainingFor = useMemo(() => (d ? Math.max(1, d.cycle.threshold - (chosen - 1)) : null), [d, chosen]);
  const remainingCost = d?.cycle.per_session != null && remainingFor != null ? d.cycle.per_session * remainingFor : null;

  // The دفعة's natural price for what it secures, used as the amount placeholder.
  const suggested = useMemo(() => {
    if (!d) return null;
    switch (terms.securesEffective) {
      case 'session': {
        const n = s.sessions.trim() !== '' ? Number(s.sessions) : remainingFor ?? 1;
        return d.booking.price_session != null ? d.booking.price_session * n : null;
      }
      case 'booklet': return d.booking.price_booklet;
      case 'flat': return d.booking.price_flat;
      default: return null;
    }
  }, [d, terms.securesEffective, s.sessions, remainingFor]);

  // What the advance invoice will come to: the remaining sessions, minus a session/flat
  // دفعة (typed, else its default) — the same arithmetic the server does, as a preview.
  const monthBill = useMemo(() => {
    if (remainingCost == null) return null;
    let credit = 0;
    if (s.bookingOn && terms.securesEffective !== 'booklet') {
      const typed = s.amount.trim() !== '' ? Number(s.amount) : null;
      credit = typed ?? suggested ?? 0;
    }
    return Math.max(0, Math.round((remainingCost - Math.min(credit, remainingCost)) * 100) / 100);
  }, [remainingCost, s.bookingOn, s.amount, terms.securesEffective, suggested]);

  if (terms.courseId == null) return null;
  if (terms.isLoading || !d) {
    return (
      <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View>
      {/* 1. Where the class is, and where this student starts. */}
      <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
          المقرر الآن على الحصة {d.cycle.position} من {d.cycle.threshold}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textTertiary, marginTop: 2, marginBottom: spacing.sm }}>
          الطالب يبدأ من الحصة رقم — ما قبلها لا يُحاسَب عليه. إن لم تختر، يُحاسَب من موضع المقرر الآن.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {Array.from({ length: d.cycle.threshold }, (_, i) => i + 1).map((n) => {
            const active = n === chosen;
            const isNow = n === d.cycle.position;
            const pos = d.cycle.timeline.positions.find((p) => p.n === n);
            return (
              <TouchableOpacity key={n} onPress={() => terms.set({ joinsAt: n })} activeOpacity={0.8}
                style={{ minWidth: 44, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: 999, alignItems: 'center',
                  backgroundColor: active ? colors.brand : colors.surfaceSunken, borderWidth: 1.5, borderColor: active ? colors.brand : isNow ? colors.brand : colors.borderStrong }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: active ? '#fff' : colors.textPrimary }}>{n}</Text>
                {pos?.label ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 10, lineHeight: 13, color: active ? 'rgba(255,255,255,0.85)' : colors.textTertiary }} numberOfLines={1}>
                    {pos.label}{pos.is_past ? '' : ' · قادمة'}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {remainingFor != null ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary, marginTop: spacing.sm }}>
            {`يُحاسَب على ${remainingFor} ${remainingFor === 1 ? 'حصة متبقية' : 'حصص متبقية'} من هذه الدورة${remainingCost != null ? ` — ${money(remainingCost)}` : ''}، والدورة القادمة كاملة.`}
          </Text>
        ) : null}
      </View>

      {/* 2. The دفعة. */}
      <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>دفعة الحجز</Text>
            {!d.booking.required ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>لا تطلب دفعة افتراضيًا — يمكنك طلبها من هذا الطالب فقط.</Text>
            ) : null}
          </View>
          <Switch value={!!s.bookingOn} onValueChange={(v) => terms.set({ bookingOn: v })} trackColor={{ true: colors.brand, false: colors.border }} />
        </View>
        {s.bookingOn ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={label()}>تؤمّن</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
              {SECURES.map((o) => {
                const active = terms.securesEffective === o.key;
                return (
                  <TouchableOpacity key={o.key} onPress={() => terms.set({ secures: o.key })} activeOpacity={0.8}
                    style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: active ? colors.brand : colors.borderStrong, backgroundColor: active ? colors.brandTint : colors.surface }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? colors.brand : colors.textSecondary }}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {terms.securesEffective === 'session' ? (
              <>
                <Text style={label()}>عدد الحصص التي تغطّيها</Text>
                <TextInput value={s.sessions} onChangeText={(v) => terms.set({ sessions: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad"
                  placeholder={remainingFor != null ? `${remainingFor} (المتبقي من الدورة)` : 'مثال: 3'} placeholderTextColor={colors.textTertiary} style={{ ...field, marginBottom: spacing.md }} />
              </>
            ) : null}
            <Text style={label()}>قيمة الدفعة</Text>
            <TextInput value={s.amount} onChangeText={(v) => terms.set({ amount: v.replace(/[^0-9.]/g, '') })} keyboardType="numeric"
              placeholder={suggested != null ? `${suggested} (الافتراضي)` : 'المبلغ'} placeholderTextColor={colors.textTertiary} style={{ ...field, marginBottom: spacing.xs }} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginBottom: spacing.md }}>اتركها فارغة لاستخدام السعر الافتراضي.</Text>
            <Text style={label()}>المدفوع الآن (اختياري)</Text>
            <TextInput value={s.paid} onChangeText={(v) => terms.set({ paid: v.replace(/[^0-9.]/g, '') })} keyboardType="numeric"
              placeholder="0" placeholderTextColor={colors.textTertiary} style={{ ...field, borderColor: terms.overpaid ? colors.danger : colors.borderStrong }} />
            {terms.overpaid ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.danger, marginTop: spacing.xs }}>المدفوع أكبر من قيمة الدفعة.</Text>
            ) : s.amount.trim() !== '' && s.paid.trim() !== '' ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginTop: spacing.xs }}>المتبقي على الأسرة: {money(Number(s.amount) - Number(s.paid))}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* 3. The booklet — raised either way; the only question is whether it was paid now. */}
      {d.booklet.offered ? (
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: s.bookletPaid ? colors.success : colors.textPrimary }}>
                {s.bookletPaid ? 'تم تحصيل الملزمة' : 'لم تُحصَّل الملزمة'}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginTop: 2 }}>
                {`${d.booklet.price ?? ''} ج.م — تُسجَّل على الطالب في الحالتين`}
              </Text>
            </View>
            <Switch value={s.bookletPaid} onValueChange={(v) => terms.set({ bookletPaid: v })} trackColor={{ true: colors.success, false: colors.border }} />
          </View>
        </View>
      ) : null}

      {/* 4. This month's fee — the one thing a newly joined teacher could not say before:
          «the family already paid this month, before I was on the system». The invoice is
          still issued (the month is owed and the report must say so) and settled at once
          as prior money: no drawer, not «collected», the next cycle bills normally. */}
      {d.cycle.cycle_price != null && monthBill != null ? (
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: s.cyclePaid ? colors.success : colors.textPrimary }}>
                {s.cyclePaid ? 'رسوم هذا الشهر مدفوعة مسبقًا' : `رسوم هذا الشهر: ${money(monthBill)}`}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textTertiary, marginTop: 2 }}>
                {s.cyclePaid
                  ? 'دفعتها الأسرة قبل الانضمام للنظام — تُسجَّل كمسدَّدة دون أن تُحسب ضمن المحصَّل أو درج النقدية.'
                  : 'تُصدر فاتورة بهذا المبلغ وتُحصَّل عند المسح. فعِّل الخيار إن كانت الأسرة دفعت الشهر بالفعل قبل انضمامك للنظام.'}
              </Text>
            </View>
            <Switch value={s.cyclePaid} onValueChange={(v) => terms.set({ cyclePaid: v, cyclePaidAmount: v ? s.cyclePaidAmount : '' })} trackColor={{ true: colors.success, false: colors.border }} />
          </View>
          {s.cyclePaid ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={label()}>المبلغ المدفوع مسبقًا (اختياري)</Text>
              <TextInput value={s.cyclePaidAmount} onChangeText={(v) => terms.set({ cyclePaidAmount: v.replace(/[^0-9.]/g, '') })} keyboardType="numeric"
                placeholder={`${monthBill} (كامل الفاتورة)`} placeholderTextColor={colors.textTertiary} style={field()} />
              {s.cyclePaidAmount.trim() !== '' && Number(s.cyclePaidAmount) < monthBill ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginTop: spacing.xs }}>
                  {`يبقى على الأسرة ${money(monthBill - Number(s.cyclePaidAmount))} تُحصَّل عند المسح.`}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
