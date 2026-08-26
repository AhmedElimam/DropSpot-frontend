import { useMemo, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { collectPayment, waivePayment, type PayKind } from '@/api/payments';
import type { ScanPending } from '@/api/teacher';

interface DueRow {
  kind: PayKind;
  label: string;
  remaining: number;
  paid: number; // already collected toward this kind (a part-payment) — shows "the rest"
  input: string;
}

/**
 * Merged pay-on-scan popup. After a scan surfaces a student's dues (bill / booklet(s) /
 * booking down-payment), this one modal lists a row per kind with the paid/remaining +
 * amount input + "دفع بالكامل" UI, collecting each kind independently (backend applies
 * oldest-first per kind). Rows drop as they clear; the modal closes when nothing is left.
 */
export function PayDuesModal({
  visible, card, name, pending, online = true, canWaive = false, onClose, onCollected,
}: {
  visible: boolean;
  card: string;
  name: string;
  pending: ScanPending | null;
  online?: boolean;
  // Teacher-only: when true, clearing a row's amount to 0 lets the teacher WAIVE
  // (write off) that due instead of collecting. Assistants never see it.
  canWaive?: boolean;
  onClose: () => void;
  onCollected?: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const initial = useMemo<DueRow[]>(() => {
    if (!pending) return [];
    const rows: DueRow[] = [];
    if (pending.bill && pending.bill.total > 0) {
      rows.push({ kind: 'bill', label: t('teacher.due_bill'), remaining: pending.bill.total, paid: pending.bill.paid ?? 0, input: String(pending.bill.total) });
    }
    const bookletTotal = (pending.booklets ?? []).reduce((s, b) => s + (b.amount ?? 0), 0);
    const bookletPaid = (pending.booklets ?? []).reduce((s, b) => s + (b.paid ?? 0), 0);
    if (bookletTotal > 0) {
      rows.push({ kind: 'booklet', label: `${t('teacher.due_booklet')} (${pending.booklets.length})`, remaining: bookletTotal, paid: bookletPaid, input: String(bookletTotal) });
    }
    if (pending.booking && pending.booking.total > 0) {
      const label = pending.booking.secures ? `${t('teacher.due_booking')} — ${pending.booking.secures}` : t('teacher.due_booking');
      rows.push({ kind: 'booking', label, remaining: pending.booking.total, paid: pending.booking.paid ?? 0, input: String(pending.booking.total) });
    }
    return rows;
  }, [pending, t]);

  const [rows, setRows] = useState<DueRow[]>(initial);
  const [busy, setBusy] = useState<PayKind | null>(null);
  // Re-seed rows whenever a new student's dues arrive.
  const [seed, setSeed] = useState<ScanPending | null>(null);
  if (pending !== seed) {
    setSeed(pending);
    setRows(initial);
  }

  const setInput = (kind: PayKind, v: string) =>
    setRows((rs) => rs.map((r) => (r.kind === kind ? { ...r, input: v.replace(/[^0-9.]/g, '') } : r)));
  const payFull = (kind: PayKind) =>
    setRows((rs) => rs.map((r) => (r.kind === kind ? { ...r, input: String(r.remaining) } : r)));

  const collect = async (row: DueRow) => {
    const amt = Number(row.input);
    if (!(amt > 0)) return;
    if (!online) { Alert.alert('', t('teacher.pay_offline')); return; }
    setBusy(row.kind);
    try {
      const res = await collectPayment(row.kind, card, amt);
      if (res.success) {
        onCollected?.();
        const remaining = Number(res.remaining) || 0;
        setRows((rs) => {
          const next = remaining > 0
            ? rs.map((r) => (r.kind === row.kind ? { ...r, remaining, paid: r.paid + Math.max(0, r.remaining - remaining), input: String(remaining) } : r))
            : rs.filter((r) => r.kind !== row.kind);
          if (next.length === 0) setTimeout(onClose, 250);
          return next;
        });
      }
    } catch {
      Alert.alert(t('common.error'), t('teacher.pay_offline'));
    } finally {
      setBusy(null);
    }
  };

  // Write-off (teacher-only): forgive the row's remaining balance without collecting.
  // Guarded by a confirm dialog since it can't be undone.
  const waive = (row: DueRow) => {
    if (!online) { Alert.alert('', t('teacher.pay_offline')); return; }
    Alert.alert(
      t('teacher.waive_confirm_title'),
      t('teacher.waive_confirm_body', { amount: row.remaining, what: row.label }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('teacher.waive_confirm_yes'),
          style: 'destructive',
          onPress: async () => {
            setBusy(row.kind);
            try {
              const res = await waivePayment(row.kind, card);
              if (res.success) {
                onCollected?.();
                setRows((rs) => {
                  const next = rs.filter((r) => r.kind !== row.kind);
                  if (next.length === 0) setTimeout(onClose, 250);
                  return next;
                });
              } else {
                Alert.alert('', res.message || t('teacher.scan_failed'));
              }
            } catch {
              Alert.alert(t('common.error'), t('teacher.scan_failed'));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: spacing.xl + insets.bottom, maxHeight: '85%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('teacher.dues_title')}</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: spacing.xs }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg }}>{name}</Text>

          {!online ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warning + '22', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger }} />
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{t('teacher.pay_offline')}</Text>
            </View>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false}>
            {rows.map((row) => {
              const amt = Number(row.input) || 0;
              const after = Math.max(0, row.remaining - amt);
              return (
                <View key={row.kind} style={{ backgroundColor: colors.background, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>{row.label}</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand }}>{row.paid > 0 ? 'المتبقّي ' : ''}{row.remaining} {t('insights.egp')}</Text>
                  </View>
                  {row.paid > 0 ? (
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.success, marginTop: 2 }}>{`مدفوع مسبقًا: ${row.paid} `}{t('insights.egp')}</Text>
                  ) : null}

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
                    <TextInput
                      value={row.input}
                      onChangeText={(v) => setInput(row.kind, v)}
                      keyboardType="numeric"
                      style={{ flex: 1, height: 44, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }}
                    />
                    <TouchableOpacity onPress={() => payFull(row.kind)} style={{ paddingHorizontal: spacing.md, height: 44, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.pay_full')}</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
                    {`المتبقي بعد الدفع: ${after} `}{t('insights.egp')}
                  </Text>

                  {(() => {
                    // amount > 0 → collect; amount 0 with a teacher → waive (write-off).
                    const isWaive = amt <= 0 && canWaive;
                    const enabled = online && (amt > 0 || isWaive);
                    return (
                      <TouchableOpacity
                        onPress={() => (amt > 0 ? collect(row) : isWaive ? waive(row) : undefined)}
                        disabled={busy === row.kind || !enabled}
                        activeOpacity={0.85}
                        style={{ marginTop: spacing.sm, minHeight: 46, borderRadius: radius.md, backgroundColor: !enabled ? colors.border : isWaive ? colors.warning : colors.success, justifyContent: 'center', alignItems: 'center' }}
                      >
                        {busy === row.kind ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{isWaive ? t('teacher.waive_button') : 'تأكيد التحصيل'}</Text>}
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity onPress={onClose} style={{ paddingVertical: spacing.sm, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
