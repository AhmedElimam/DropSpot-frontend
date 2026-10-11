import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, useWindowDimensions } from 'react-native';
import { Alert } from '@/ui/dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
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
  if (m.phase === 'before_join' && !bill) return { bg: colors.surfaceSunken, border: colors.surfaceSunken, fg: colors.textTertiary, note: i18n.t('billing_sheets.before_join') };
  if (!bill) return { bg: colors.surface, border: colors.border, fg: colors.textSecondary, note: i18n.t('billing_sheets.no_bill'), dashed: true };
  const owed = m.bills.reduce((t, b) => t + num(b.remaining), 0);
  const paid = m.bills.reduce((t, b) => t + num(b.paid), 0);
  if (owed <= 0.001) return { bg: colors.successLight, border: colors.success, fg: colors.successText, note: i18n.t('billing_sheets.paid') };
  if (m.bills.some((b) => b.status === 'overdue')) return { bg: colors.dangerLight, border: colors.danger, fg: colors.dangerText, note: i18n.t('collections.overdue') };
  if (paid > 0) return { bg: colors.warningLight, border: colors.warning, fg: colors.warningText, note: i18n.t('billing_sheets.partly_paid') };
  return { bg: colors.brandTint, border: colors.brand, fg: colors.brand, note: i18n.t('collections.due') };
}

export function BillingYearSheet({ target, onClose }: { target: BillingYearTarget | null; onClose: () => void }) {
  const { t } = useTranslation();
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
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('billing_sheets.student_year')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>{data?.student.name ?? target?.name ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
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
            <TouchableOpacity onPress={() => { setYear((y) => y - 1); setPicked(null); }} accessibilityRole="button" accessibilityLabel={t('billing_sheets.prev_year')}
              style={{ width: 40, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
              <Icon name="forward" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{formatNumber(year, { useGrouping: false })}</Text>
            <TouchableOpacity onPress={() => { setYear((y) => y + 1); setPicked(null); }} disabled={year >= new Date().getFullYear() + 1} accessibilityRole="button" accessibilityLabel={t('billing_sheets.next_year')}
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
  const { t } = useTranslation();
  const dot = (c: string, label: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c }} />
      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }}>{label}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md }}>
      {dot(colors.success, t('billing_sheets.paid'))}{dot(colors.warning, t('billing_sheets.partly_paid'))}{dot(colors.brand, t('collections.due'))}{dot(colors.danger, t('collections.overdue'))}{dot(colors.border, t('billing_sheets.no_bill'))}
    </View>
  );
}

function MonthTile({ m, on, onPress }: { m: YearMonth; on: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const tn = tone(m);
  const total = m.bills.reduce((s, b) => s + num(b.amount), 0);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{
        width: '31.6%', minHeight: 92, borderRadius: radius.lg, padding: spacing.sm, backgroundColor: tn.bg,
        borderWidth: on ? 2.5 : m.current ? 2 : 1, borderColor: on ? colors.accent : m.current ? colors.brand : tn.border,
        borderStyle: tn.dashed && !on ? 'dashed' : 'solid', opacity: tn.faded ? 0.5 : 1,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{m.label}</Text>
        {m.current ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand }} /> : null}
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: tn.fg, marginTop: 4 }} numberOfLines={1}>
        {m.bills.length ? formatEGP(total) : tn.note || ' '}
      </Text>
      {m.bills.length ? <Text style={{ fontFamily: fonts.regular, fontSize: 10.5, color: tn.fg }}>{tn.note}</Text> : null}
      {m.phase !== 'future' && m.held > 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 10.5, color: colors.textTertiary, marginTop: 2 }}>{t('billing_sheets.attended_short', { attended: formatNumber(m.attended), held: formatNumber(m.held) })}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function MonthPanel({ data, m, onChanged, onPrior }: { data: BillingYear; m: YearMonth; onChanged: () => Promise<void>; onPrior: () => void }) {
  const { t } = useTranslation();
  const title = `${m.label} ${formatNumber(Number(m.month.slice(0, 4)), { useGrouping: false })}`;
  const past = m.month < `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  return (
    <View style={{ marginTop: spacing.lg, backgroundColor: colors.background, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{title}</Text>
        {m.phase !== 'future' ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary }}>
              {m.held > 0 ? t('billing_sheets.attended_of', { attended: formatNumber(m.attended), held: formatNumber(m.held) }) : t('billing_sheets.no_sessions_recorded')}
            </Text>
          </View>
        ) : null}
      </View>

      {m.bills.map((b) => <BillCard key={b.invoice_id} data={data} b={b} onChanged={onChanged} />)}

      {m.phase === 'future' ? (
        <Note text={t('billing_sheets.future_month_note')} />
      ) : !m.bills.length && m.phase === 'joined' ? (
        data.can.add && m.can_add ? <AddForm data={data} m={m} past={past} onChanged={onChanged} /> : <Note text={t('billing_sheets.no_bill_note')} />
      ) : !m.bills.length && m.phase === 'before_join' ? (
        m.can_prior && data.can.prior ? (
          <View style={{ marginTop: spacing.md }}>
            <Note text={t('billing_sheets.before_join_note')} />
            <Primary label={t('billing_sheets.record_as_prior', { month: m.label })} icon="calendar" onPress={onPrior} />
          </View>
        ) : <Note text={t('billing_sheets.before_join_short')} />
      ) : null}
    </View>
  );
}

function BillCard({ data, b, onChanged }: { data: BillingYear; b: YearBill; onChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(Math.round(num(b.amount))));
  const [sessions, setSessions] = useState(String(b.threshold || data.sessions_per_cycle || ''));
  const [paid, setPaid] = useState(String(Math.round(num(b.paid))));
  const [busy, setBusy] = useState(false);
  const owed = num(b.remaining);
  const state = owed <= 0.001 ? { fg: colors.successText, bg: colors.successLight, t: t('billing_sheets.paid') }
    : b.status === 'overdue' ? { fg: colors.dangerText, bg: colors.dangerLight, t: t('collections.overdue') }
    : num(b.paid) > 0 ? { fg: colors.warningText, bg: colors.warningLight, t: t('billing_sheets.partly_paid') }
    : { fg: colors.brand, bg: colors.brandTint, t: t('collections.due') };

  const save = async () => {
    const a = Number(amount), s = Number(sessions), p = Number(paid);
    if (!Number.isFinite(a) || a <= 0) return Alert.alert('', t('billing_sheets.enter_amount'));
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
    Alert.alert(t('billing_sheets.cancel_bill_title'), t('billing_sheets.cancel_bill_body', { number: b.number, amount: formatEGP(num(b.amount)) }), [
      { text: t('common.back'), style: 'cancel' },
      { text: t('billing_sheets.cancel_bill'), style: 'destructive', onPress: async () => {
        try { await cancelBillingMonth(data.enrollment_id, b.invoice_id); await onChanged(); } catch (e) { Alert.alert('', getFriendlyErrorMessage(e)); }
      } },
    ]);
  };

  return (
    <View style={{ marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderStartWidth: 4, borderStartColor: state.fg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} numberOfLines={2}>{b.line ?? t('billing_sheets.bill_number', { number: b.number })}</Text>
        <View style={{ backgroundColor: state.bg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: state.fg }}>{state.t}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
        {[[t('invoices.amount'), num(b.amount)], [t('invoices.paid_amount'), num(b.paid)], [t('billing_sheets.remaining'), owed]].map(([l, v]) => (
          <View key={l as string} style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{l}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{formatEGP(v as number)}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 4 }}>
        {b.number}{b.due_date ? ` · ${t('billing_sheets.due_on', { date: b.due_date })}` : ''}{b.open_cycle ? ` · ${t('billing_sheets.open_cycle_attended', { attended: formatNumber(b.sessions), held: formatNumber(b.threshold) })}` : ''}
      </Text>

      {editing ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Field label={t('expenses.amount')} value={amount} onChange={setAmount} />
            <Field label={t('collections.bill_sessions')} value={sessions} onChange={setSessions} />
            <Field label={t('invoices.paid_amount')} value={paid} onChange={setPaid} />
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary, lineHeight: 18 }}>
            {t('billing_sheets.edit_bill_hint')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Secondary label={t('common.back')} onPress={() => setEditing(false)} />
            <Primary label={busy ? '…' : t('common.save')} onPress={save} disabled={busy} flex />
          </View>
        </View>
      ) : data.can.edit || (data.can.cancel && num(b.paid) <= 0.001) ? (
        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
          {data.can.edit ? (
            <TouchableOpacity onPress={() => setEditing(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="note" size={14} color={colors.brand} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('billing_sheets.edit')}</Text>
            </TouchableOpacity>
          ) : null}
          {data.can.cancel && num(b.paid) <= 0.001 ? (
            <TouchableOpacity onPress={cancel} hitSlop={8}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.dangerText }}>{t('billing_sheets.cancel_bill')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function AddForm({ data, m, past, onChanged }: { data: BillingYear; m: YearMonth; past: boolean; onChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(data.price ? String(Math.round(num(data.price))) : '');
  const [sessions, setSessions] = useState(String(data.sessions_per_cycle || m.held || ''));
  // This month, while the running cycle still carries an earlier month's bill: that cycle's
  // next bill comes by itself when it completes — say so before a bill is issued by hand.
  const running = m.current ? data.months.flatMap((x) => x.bills.filter((b) => b.open_cycle && x.month < m.month)).at(0) : undefined;
  const [busy, setBusy] = useState(false);
  const add = async () => {
    const a = Number(amount), s = Number(sessions);
    if (!Number.isFinite(a) || a <= 0) return Alert.alert('', t('billing_sheets.enter_amount'));
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
        ? t('billing_sheets.add_bill_note_past')
        : t('billing_sheets.add_bill_note')} />
      {running ? (
        <View style={{ backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.sm }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.warningText, lineHeight: 20 }}>
            {t('billing_sheets.running_cycle_warning', { attended: formatNumber(running.sessions), held: formatNumber(running.threshold) })}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Field label={t('expenses.amount')} value={amount} onChange={setAmount} />
        <Field label={t('collections.bill_sessions')} value={sessions} onChange={setSessions} />
      </View>
      <Primary label={busy ? '…' : t('billing_sheets.issue_bill', { month: m.label })} icon="add" onPress={add} disabled={busy} />
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
