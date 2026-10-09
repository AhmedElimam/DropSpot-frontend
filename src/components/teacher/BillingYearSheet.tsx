import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Alert, useWindowDimensions } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetModal } from '@/components/ui/SheetModal';
import { Icon } from '@/components/ui/Icon';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { formatEGP } from '@/utils/currency';
import { formatNumber } from '@/utils/format';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { getBillingYear, addBillingMonth, cancelBillingMonth, type YearMonth, type YearBill, type BillingYear } from '@/api/billingYear';
import { setCycleAmount } from '@/api/enrollments';
import { PriorMonthSheet } from './PriorMonthSheet';

/**
 * «السنة» — a student's year in a course, month by month (founder 2026-10-08: «edit what the
 * student should pay, for which month, for how many sessions — and show me the months calendar
 * for the whole year»). January to December (any course, not only school-year ones), arrows for
 * other years, a chip per course when the student has more than one.
 *
 * Each month tile says at a glance: its bill and how it stands (paid · partly · owed · late),
 * or that it has none, or that it is before the student joined / not come yet — and «حضر a/h».
 * A tap opens the month underneath: its bill(s) with «تعديل» (amount · sessions · paid) and
 * «إلغاء الفاتورة» (teacher, nothing paid), «إصدار فاتورة» for a joined month with none, and
 * «تسجيل شهر سابق» for a month before joining. Only what this person may do is shown.
 */
export interface BillingYearTarget {
  studentId: number;
  name?: string | null;
  enrollmentId?: number | null;
}

const num = (v: string | number | null | undefined) => Number(v ?? 0);

function tone(m: YearMonth): { bg: string; border: string; fg: string; note: string; dashed?: boolean; faded?: boolean } {
  const bill = m.bills[0];
  if (m.phase === 'future') return { bg: colors.surface, border: colors.borderLight, fg: colors.textTertiary, note: '', faded: true };
  if (m.phase === 'before_join' && !bill) return { bg: colors.surfaceSunken, border: colors.surfaceSunken, fg: colors.textTertiary, note: 'قبل الانضمام' };
  if (!bill) return { bg: colors.surface, border: colors.border, fg: colors.textSecondary, note: 'بدون فاتورة', dashed: true };
  const owed = m.bills.reduce((t, b) => t + num(b.remaining), 0);
  const paid = m.bills.reduce((t, b) => t + num(b.paid), 0);
  if (owed <= 0.001) return { bg: colors.successLight, border: colors.success, fg: colors.successText, note: 'مدفوعة' };
  if (m.bills.some((b) => b.status === 'overdue')) return { bg: colors.dangerLight, border: colors.danger, fg: colors.dangerText, note: 'متأخرة' };
  if (paid > 0) return { bg: colors.warningLight, border: colors.warning, fg: colors.warningText, note: 'مدفوع جزء' };
  return { bg: colors.brandTint, border: colors.brand, fg: colors.brand, note: 'مستحقة' };
}

export function BillingYearSheet({ target, onClose }: { target: BillingYearTarget | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const qc = useQueryClient();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [enrollmentId, setEnrollmentId] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [prior, setPrior] = useState<{ enrollmentId: number; courseName: string | null } | null>(null);

  useEffect(() => {
    if (target) { setYear(new Date().getFullYear()); setEnrollmentId(target.enrollmentId ?? null); setPicked(null); }
  }, [target]);

  const q = useQuery({
    queryKey: ['billing-year', target?.studentId, enrollmentId, year],
    queryFn: () => getBillingYear(target!.studentId, { year, enrollmentId: enrollmentId ?? undefined }),
    enabled: !!target,
  });
  const data = q.data;
  const nowKey = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }, []);
  const selected = data?.months.find((m) => m.month === picked) ?? data?.months.find((m) => m.month === nowKey) ?? null;

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['billing-year'] });
    qc.invalidateQueries({ queryKey: ['pending-collections'] });
    qc.invalidateQueries({ queryKey: ['teacher-student'] });
  };
  const courseName = data?.enrollments.find((e) => e.id === data.enrollment_id)?.course ?? null;

  return (
    <>
      <SheetModal visible={!!target && !prior} onClose={onClose} avoidKeyboard
        style={{ backgroundColor: colors.surface, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.md, maxHeight: height * 0.92 }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="calendar" size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>سنة الطالب</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>{data?.student.name ?? target?.name ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="إغلاق">
              <Icon name="close" size={22} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* A chip per course, when there is more than one. */}
          {data && data.enrollments.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }} contentContainerStyle={{ gap: spacing.sm }}>
              {data.enrollments.map((e) => {
                const on = e.id === data.enrollment_id;
                return (
                  <TouchableOpacity key={e.id} onPress={() => { setEnrollmentId(e.id); setPicked(null); }} accessibilityRole="button"
                    style={{ paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full, backgroundColor: on ? colors.brand : colors.surfaceSunken }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: on ? '#fff' : colors.textSecondary }} numberOfLines={1}>{e.course ?? '—'}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : courseName ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand, marginTop: spacing.sm }} numberOfLines={1}>{courseName}</Text>
          ) : null}

          {/* The year, with arrows (RTL: the earlier year on the right). */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: 4 }}>
            <TouchableOpacity onPress={() => { setYear((y) => y - 1); setPicked(null); }} accessibilityRole="button" accessibilityLabel="السنة السابقة"
              style={{ width: 40, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
              <Icon name="forward" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{formatNumber(year, { useGrouping: false })}</Text>
            <TouchableOpacity onPress={() => { setYear((y) => y + 1); setPicked(null); }} disabled={year >= new Date().getFullYear() + 1} accessibilityRole="button" accessibilityLabel="السنة التالية"
              style={{ width: 40, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, opacity: year >= new Date().getFullYear() + 1 ? 0.4 : 1 }}>
              <Icon name="back" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {q.isLoading || !data ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xxl }} />
          ) : (
            <>
              <Legend />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
                {data.months.map((m) => <MonthTile key={m.month} m={m} on={selected?.month === m.month} onPress={() => setPicked(m.month)} />)}
              </View>
              {selected ? (
                <MonthPanel key={`${data.enrollment_id}-${selected.month}`} data={data} m={selected} onChanged={refresh}
                  onPrior={() => setPrior({ enrollmentId: data.enrollment_id, courseName })} />
              ) : null}
            </>
          )}
        </ScrollView>
      </SheetModal>
      <PriorMonthSheet target={prior} onClose={() => setPrior(null)} onSaved={() => { setPrior(null); void refresh(); }} />
    </>
  );
}

function Legend() {
  const dot = (c: string, label: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c }} />
      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }}>{label}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md }}>
      {dot(colors.success, 'مدفوعة')}{dot(colors.warning, 'مدفوع جزء')}{dot(colors.brand, 'مستحقة')}{dot(colors.danger, 'متأخرة')}{dot(colors.border, 'بدون فاتورة')}
    </View>
  );
}

function MonthTile({ m, on, onPress }: { m: YearMonth; on: boolean; onPress: () => void }) {
  const t = tone(m);
  const total = m.bills.reduce((s, b) => s + num(b.amount), 0);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{
        width: '31.6%', minHeight: 92, borderRadius: radius.lg, padding: spacing.sm, backgroundColor: t.bg,
        borderWidth: on ? 2.5 : m.current ? 2 : 1, borderColor: on ? colors.accent : m.current ? colors.brand : t.border,
        borderStyle: t.dashed && !on ? 'dashed' : 'solid', opacity: t.faded ? 0.5 : 1,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{m.label}</Text>
        {m.current ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand }} /> : null}
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: t.fg, marginTop: 4 }} numberOfLines={1}>
        {m.bills.length ? formatEGP(total) : t.note || ' '}
      </Text>
      {m.bills.length ? <Text style={{ fontFamily: fonts.regular, fontSize: 10.5, color: t.fg }}>{t.note}</Text> : null}
      {m.phase !== 'future' && m.held > 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 10.5, color: colors.textTertiary, marginTop: 2 }}>حضر {formatNumber(m.attended)}/{formatNumber(m.held)}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function MonthPanel({ data, m, onChanged, onPrior }: { data: BillingYear; m: YearMonth; onChanged: () => Promise<void>; onPrior: () => void }) {
  const title = `${m.label} ${formatNumber(Number(m.month.slice(0, 4)), { useGrouping: false })}`;
  const past = m.month < `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  return (
    <View style={{ marginTop: spacing.lg, backgroundColor: colors.background, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{title}</Text>
        {m.phase !== 'future' ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary }}>
              {m.held > 0 ? `حضر ${formatNumber(m.attended)} من ${formatNumber(m.held)} حصة` : 'مفيش حصص متسجلة'}
            </Text>
          </View>
        ) : null}
      </View>

      {m.bills.map((b) => <BillCard key={b.invoice_id} data={data} b={b} onChanged={onChanged} />)}

      {m.phase === 'future' ? (
        <Note text="الشهر ده لسه مجاش — فاتورته بتطلع لوحدها مع أول حصة فيه." />
      ) : !m.bills.length && m.phase === 'joined' ? (
        data.can.add && m.can_add ? <AddForm data={data} m={m} past={past} onChanged={onChanged} /> : <Note text="الشهر ده من غير فاتورة." />
      ) : !m.bills.length && m.phase === 'before_join' ? (
        m.can_prior && data.can.prior ? (
          <View style={{ marginTop: spacing.md }}>
            <Note text="الشهر ده قبل ما الطالب ينضم. تقدر تسجّل حضوره فيه وفاتورته." />
            <Primary label={`تسجيل ${m.label} كشهر سابق`} icon="calendar" onPress={onPrior} />
          </View>
        ) : <Note text="قبل انضمام الطالب." />
      ) : null}
    </View>
  );
}

function BillCard({ data, b, onChanged }: { data: BillingYear; b: YearBill; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(Math.round(num(b.amount))));
  const [sessions, setSessions] = useState(String(b.threshold || data.sessions_per_cycle || ''));
  const [paid, setPaid] = useState(String(Math.round(num(b.paid))));
  const [busy, setBusy] = useState(false);
  const owed = num(b.remaining);
  const state = owed <= 0.001 ? { fg: colors.successText, bg: colors.successLight, t: 'مدفوعة' }
    : b.status === 'overdue' ? { fg: colors.dangerText, bg: colors.dangerLight, t: 'متأخرة' }
    : num(b.paid) > 0 ? { fg: colors.warningText, bg: colors.warningLight, t: 'مدفوع جزء' }
    : { fg: colors.brand, bg: colors.brandTint, t: 'مستحقة' };

  const save = async () => {
    const a = Number(amount), s = Number(sessions), p = Number(paid);
    if (!Number.isFinite(a) || a <= 0) return Alert.alert('', 'اكتب المبلغ.');
    setBusy(true);
    try {
      await setCycleAmount(data.enrollment_id, { amount: a, sessions: Number.isFinite(s) && s > 0 ? s : null, paid: Number.isFinite(p) ? p : null, invoiceId: b.invoice_id });
      await onChanged();
      setEditing(false);
    } catch (e) {
      Alert.alert('', getFriendlyErrorMessage(e));
    } finally { setBusy(false); }
  };
  const cancel = () => {
    Alert.alert('إلغاء فاتورة الشهر؟', `الفاتورة ${b.number} (${formatEGP(num(b.amount))}) مش هتبقى مستحقة على الطالب.`, [
      { text: 'رجوع', style: 'cancel' },
      { text: 'إلغاء الفاتورة', style: 'destructive', onPress: async () => {
        try { await cancelBillingMonth(data.enrollment_id, b.invoice_id); await onChanged(); } catch (e) { Alert.alert('', getFriendlyErrorMessage(e)); }
      } },
    ]);
  };

  return (
    <View style={{ marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderStartWidth: 4, borderStartColor: state.fg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} numberOfLines={2}>{b.line ?? `فاتورة ${b.number}`}</Text>
        <View style={{ backgroundColor: state.bg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: state.fg }}>{state.t}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
        {[['المبلغ', num(b.amount)], ['المدفوع', num(b.paid)], ['الباقي', owed]].map(([l, v]) => (
          <View key={l as string} style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{l}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{formatEGP(v as number)}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 4 }}>
        {b.number}{b.due_date ? ` · الاستحقاق ${b.due_date}` : ''}{b.open_cycle ? ` · الدورة الجارية: حضر ${formatNumber(b.sessions)}/${formatNumber(b.threshold)}` : ''}
      </Text>

      {editing ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Field label="المبلغ (ج.م)" value={amount} onChange={setAmount} />
            <Field label="عدد الحصص" value={sessions} onChange={setSessions} />
            <Field label="المدفوع" value={paid} onChange={setPaid} />
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary, lineHeight: 18 }}>
            نفس الفاتورة بتتعدّل — نفس الرقم وميعاد الاستحقاق. المدفوع يزيد بس (لو اتدفع قبل كده ومتسجلش)؛ لتقليله ألغِ التحصيل من سجل المدفوعات.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Secondary label="رجوع" onPress={() => setEditing(false)} />
            <Primary label={busy ? '…' : 'حفظ'} onPress={save} disabled={busy} flex />
          </View>
        </View>
      ) : data.can.edit || (data.can.cancel && num(b.paid) <= 0.001) ? (
        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
          {data.can.edit ? (
            <TouchableOpacity onPress={() => setEditing(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="note" size={14} color={colors.brand} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>تعديل</Text>
            </TouchableOpacity>
          ) : null}
          {data.can.cancel && num(b.paid) <= 0.001 ? (
            <TouchableOpacity onPress={cancel} hitSlop={8}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.dangerText }}>إلغاء الفاتورة</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function AddForm({ data, m, past, onChanged }: { data: BillingYear; m: YearMonth; past: boolean; onChanged: () => Promise<void> }) {
  const [amount, setAmount] = useState(data.price ? String(Math.round(num(data.price))) : '');
  const [sessions, setSessions] = useState(String(data.sessions_per_cycle || m.held || ''));
  // This month, while the running cycle still carries an earlier month's bill: that cycle's
  // next bill comes by itself when it completes — say so before a bill is issued by hand.
  const running = m.current ? data.months.flatMap((x) => x.bills.filter((b) => b.open_cycle && x.month < m.month)).at(0) : undefined;
  const [busy, setBusy] = useState(false);
  const add = async () => {
    const a = Number(amount), s = Number(sessions);
    if (!Number.isFinite(a) || a <= 0) return Alert.alert('', 'اكتب المبلغ.');
    setBusy(true);
    try {
      await addBillingMonth(data.enrollment_id, { month: m.month, amount: a, sessions: Number.isFinite(s) && s > 0 ? s : null });
      await onChanged();
    } catch (e) {
      Alert.alert('', getFriendlyErrorMessage(e));
    } finally { setBusy(false); }
  };
  return (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      <Note text={past
        ? 'الشهر ده من غير فاتورة. لو أصدرتها هتبقى مستحقة على طول — والطالب يتوقف على الباب لحد ما يدفعها، زي أي فاتورة متأخرة.'
        : 'الشهر ده من غير فاتورة. أصدرها بالمبلغ وعدد الحصص.'} />
      {running ? (
        <View style={{ backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.sm }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.warningText, lineHeight: 20 }}>
            {`الدورة الجارية لسه ماخلصتش (حضر ${formatNumber(running.sessions)}/${formatNumber(running.threshold)}) — فاتورتها الجاية بتطلع لوحدها لما تخلص. أصدر فاتورة الشهر ده بإيدك بس لو اتفقت على كده.`}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Field label="المبلغ (ج.م)" value={amount} onChange={setAmount} />
        <Field label="عدد الحصص" value={sessions} onChange={setSessions} />
      </View>
      <Primary label={busy ? '…' : `إصدار فاتورة ${m.label}`} icon="add" onPress={add} disabled={busy} />
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary, marginBottom: 4 }}>{label}</Text>
      <TextInput value={value} onChangeText={(v) => onChange(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad"
        style={{ height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, textAlign: 'center' }} />
    </View>
  );
}

function Note({ text }: { text: string }) {
  return <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 21, marginTop: spacing.sm }}>{text}</Text>;
}

function Primary({ label, onPress, disabled, icon, flex }: { label: string; onPress: () => void; disabled?: boolean; icon?: 'add' | 'calendar'; flex?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85} accessibilityRole="button"
      style={{ flex: flex ? 1 : undefined, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: radius.lg, backgroundColor: colors.brand, opacity: disabled ? 0.6 : 1, marginTop: flex ? 0 : spacing.sm }}>
      {icon ? <Icon name={icon} size={16} color="#fff" /> : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Secondary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button"
      style={{ paddingHorizontal: spacing.lg, height: 46, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  );
}
