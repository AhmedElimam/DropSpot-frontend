import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Alert } from '@/ui/dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SheetModal } from '@/components/ui/SheetModal';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { getPriorBillingMonths, recordPriorBillingMonth } from '@/api/enrollments';

/**
 * «تسجيل شهر سابق» (founder 2026-10-08: «we're in October; a student who joined in October —
 * the teacher wants to record September: its sessions and its bill»). Pick a month before the
 * student joined; tick the days he attended (the class's days that month, from the schedule —
 * even if the course was set up in the app later); the month's fee (the course price,
 * editable) is added as a bill OWED NOW, overdue at the door like any bill until it is paid or
 * the 15-day allowance covers it. The current month's cycle and bill are never touched.
 */
export function PriorMonthSheet({ target, onClose, onSaved }: {
  target: { enrollmentId: number; courseName: string | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['prior-billing-months', target?.enrollmentId],
    queryFn: () => getPriorBillingMonths(target!.enrollmentId),
    enabled: !!target,
  });
  const months = q.data?.months ?? [];
  const [month, setMonth] = useState<string>('');
  const [picked, setPicked] = useState<(number | string)[]>([]);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const current = useMemo(() => months.find((m) => m.month === month) ?? months[0], [months, month]);
  useEffect(() => {
    if (!target) { setMonth(''); setPicked([]); setAmount(''); }
  }, [target]);
  useEffect(() => {
    // A new month: nothing ticked, the fee prefilled from the course price.
    setPicked([]);
    setAmount(current && !current.invoice && current.suggested_amount ? String(Math.round(Number(current.suggested_amount))) : '');
  }, [current?.month]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (current?.days ?? []).filter((d) => d.recorded == null);
  const billed = !!current?.invoice;
  const fee = Number(amount);
  const canSave = !!current && !busy && (billed ? picked.length > 0 : Number.isFinite(fee) && fee > 0);

  const save = async () => {
    if (!target || !current || !canSave) return;
    setBusy(true);
    try {
      const r = await recordPriorBillingMonth(target.enrollmentId, { month: current.month, session_ids: picked, ...(billed ? {} : { amount: fee }) });
      await qc.invalidateQueries({ queryKey: ['prior-billing-months', target.enrollmentId] });
      qc.invalidateQueries({ queryKey: ['pending-collections'] });
      onSaved();
      onClose();
      Alert.alert(t('common.done'), r.message);
    } catch (e) {
      Alert.alert('', getFriendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetModal visible={!!target} onClose={() => !busy && onClose()} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('billing_sheets.prior_month_title', { course: target?.courseName ?? '' })}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md }}>
        {t('billing_sheets.prior_month_hint')}
      </Text>

      {q.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} /> : null}
      {q.isError ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.danger, marginBottom: spacing.md }}>{getFriendlyErrorMessage(q.error)}</Text> : null}

      {months.length > 0 ? (
        <>
          {/* The month. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
            {months.map((m) => {
              const on = m.month === current?.month;
              return (
                <TouchableOpacity key={m.month} onPress={() => setMonth(m.month)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brand + '18' : colors.surface }}>
                  {m.invoice ? <Icon name="success" size={12} color={on ? colors.brand : colors.success} /> : null}
                  <Text style={{ fontFamily: on ? fonts.bold : fonts.regular, fontSize: 13, color: on ? colors.brand : colors.textPrimary }}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Its days. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }}>{t('billing_sheets.month_sessions', { month: current?.label ?? '' })}</Text>
            {open.length > 0 ? (
              <TouchableOpacity onPress={() => setPicked(picked.length === open.length ? [] : open.map((d) => d.id))} hitSlop={6}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{picked.length === open.length ? t('billing_sheets.clear_all') : t('billing_sheets.attended_all')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {(current?.days ?? []).length === 0 ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('billing_sheets.no_scheduled_sessions')}</Text>
          ) : (current?.days ?? []).map((d) => {
            const on = picked.includes(d.id);
            const done = d.recorded != null;
            return (
              <TouchableOpacity key={String(d.id)} disabled={done} activeOpacity={0.85} accessibilityRole="checkbox" accessibilityState={{ checked: on || done, disabled: done }}
                onPress={() => setPicked(on ? picked.filter((x) => x !== d.id) : [...picked, d.id])}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.borderLight, opacity: done ? 0.6 : 1 }}>
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on || done ? colors.success : colors.border, backgroundColor: on || done ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on || done ? <Icon name="success" size={13} color="#fff" /> : null}
                </View>
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}>{d.label}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{done ? t('billing_sheets.recorded') : d.time}</Text>
              </TouchableOpacity>
            );
          })}

          {/* Its fee. */}
          <View style={{ marginTop: spacing.md, backgroundColor: billed ? colors.surfaceSunken : colors.warningLight, borderRadius: radius.lg, padding: spacing.md }}>
            {billed ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.textPrimary }}>
                {t('billing_sheets.prior_bill_recorded', { month: current!.label, amount: formatNumber(Number(current!.invoice!.amount)), remaining: formatNumber(Number(current!.invoice!.remaining)) })}
              </Text>
            ) : (
              <>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 6 }}>{t('billing_sheets.month_fee_due_now', { month: current?.label ?? '' })}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <TextInput value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, height: 48, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, textAlign: 'center' }} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary }}>{t('teacher.egp')}</Text>
                </View>
              </>
            )}
          </View>

          <TouchableOpacity onPress={save} disabled={!canSave} activeOpacity={0.85} accessibilityRole="button"
            style={{ marginTop: spacing.md, minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, opacity: canSave ? 1 : 0.5 }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Icon name="success" size={18} color="#fff" />}
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>
              {billed ? t('billing_sheets.record_sessions', { count: formatNumber(picked.length) }) : t('billing_sheets.record_month_and_bill', { month: current?.label ?? '', sessions: picked.length ? ` · ${t('billing_sheets.sessions_count', { count: formatNumber(picked.length) })}` : '' })}
            </Text>
          </TouchableOpacity>
        </>
      ) : null}
    </SheetModal>
  );
}
