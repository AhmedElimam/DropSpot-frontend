import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { formatDayDate, formatNumber } from '@/utils/format';
import { collectStudentCharge, type StudentDetail } from '@/api/students';

/**
 * What a student owes and how to collect it — shared by the full profile and the quick
 * sheet on the collections list (founder 2026-10-06), so the two never disagree about a
 * figure or a button.
 */

/** One thing to collect: a bill by its month, a ملزمة, the booking دفعة, or everything. */
export type CollectTarget = { kind: 'bill' | 'booklet' | 'booking' | 'all'; chargeId?: number; label: string; remaining: number };

type Billing = StudentDetail['billing'];

/**
 * Collect a target through the profile endpoint (same path as the kiosk: paid_at, receipt,
 * drawer, oversight, audit). Returns the sentence to show. Throws with the server's message.
 */
export async function collectTarget(studentId: string | number, target: CollectTarget, amount: number, billing: Billing): Promise<string> {
  if (target.kind === 'all') {
    // Everything owed, bills first (oldest due first on the server), then booklets, then the دفعة.
    const kinds = (['bill', 'booklet', 'booking'] as const).filter((k) => Number(billing.pending?.[k] ?? 0) > 0);
    for (const k of kinds) await collectStudentCharge(studentId, k);
    return `تم تحصيل ${formatNumber(target.remaining)} ج.م. سيصل الإيصال لولي الأمر.`;
  }
  const partial = amount < target.remaining - 0.001;
  const r = await collectStudentCharge(studentId, target.kind, target.chargeId, partial ? amount : undefined);
  return Number(r.remaining) > 0
    ? `تم تحصيل ${formatNumber(Number(r.collected))} ج.م — المتبقّي ${formatNumber(Number(r.remaining))} ج.م.`
    : `تم تحصيل ${r.what} (${formatNumber(Number(r.collected))} ج.م). سيصل الإيصال لولي الأمر.`;
}

/** The amount typed for a target, or the reason it cannot be collected. */
export function parseCollectAmount(text: string, target: CollectTarget): { amount: number } | { error: string } {
  const amount = Number(text.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0 || amount > target.remaining + 0.001) {
    return { error: `أدخل مبلغًا بين 1 و ${formatNumber(target.remaining)} ج.م.` };
  }
  return { amount };
}

/**
 * The dues card: the total in one glance (red overdue / amber owed / green clear), then every
 * charge by name — each bill by its month, each ملزمة, the booking دفعة — with «تحصيل» on the
 * row and «تحصيل الكل» under them when there is more than one.
 */
export function StudentDuesCard({ billing: b, canCollect, onCollect }: { billing: Billing; canCollect: boolean; onCollect: (t: CollectTarget) => void }) {
  const { t } = useTranslation();
  const booklets = b.booklets ?? [];
  const booking = b.booking && Number(b.booking.remaining) > 0 ? b.booking : null;
  // A server without the per-month list still says how much the bills come to: one row for them.
  const bills = b.bills ?? (Number(b.pending?.bill ?? 0) > 0
    ? [{ id: 0, course: null, month: null, amount: b.pending!.bill, paid: '0', remaining: b.pending!.bill, due_date: null, overdue: b.has_overdue }]
    : []);
  const owed = Number(b.pending_total ?? 0);
  const tone = b.has_overdue ? colors.danger : b.has_pending ? colors.warning : colors.success;
  const toneBg = b.has_overdue ? colors.dangerLight : b.has_pending ? colors.warningLight : colors.successLight;
  const count = bills.length + booklets.length + (booking ? 1 : 0);

  const row = (key: string, icon: 'money' | 'book' | 'card', title: string, sub: string | null, remaining: number, overdue: boolean, target: CollectTarget) => (
    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: overdue ? colors.dangerLight : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={17} color={overdue ? colors.danger : colors.textSecondary} outline />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }} numberOfLines={1}>{title}</Text>
          {overdue ? <Badge label={t('teacher.billing_overdue')} variant="danger" size="sm" /> : null}
        </View>
        {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: overdue ? colors.danger : colors.textPrimary }}>{`${formatNumber(remaining)} ج.م`}</Text>
      {canCollect ? (
        <TouchableOpacity onPress={() => onCollect(target)} accessibilityRole="button" activeOpacity={0.85}
          style={{ backgroundColor: colors.success, borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: spacing.md }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: '#fff' }}>تحصيل</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: b.has_pending ? tone : colors.border, overflow: 'hidden', ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: toneBg }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="money" size={24} color={tone} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{b.has_pending ? t('teacher.billing_pending') : t('teacher.billing_clear')}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, color: tone }}>{b.has_pending ? `${formatNumber(owed)} ج.م` : '✓'}</Text>
          {b.has_overdue ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.danger }}>{`${t('teacher.billing_overdue')} · ${formatNumber(Number(b.overdue_amount))} ج.م`}</Text> : null}
          {b.override_active ? (
            <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Badge label={t('teacher.billing_override_active')} variant="info" size="sm" />
              {b.override_expires_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('teacher.override_until', { date: formatDayDate(b.override_expires_at) })}</Text> : null}
            </View>
          ) : null}
        </View>
      </View>
      {count > 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          {bills.map((x) => row(`bill-${x.id}`, 'money', x.month ? `فاتورة ${x.month}` : 'فاتورة الدورة',
            [x.course, Number(x.paid) > 0 ? `مدفوع ${formatNumber(Number(x.paid))} من ${formatNumber(Number(x.amount))}` : null].filter(Boolean).join(' · ') || null,
            Number(x.remaining), x.overdue,
            { kind: 'bill', chargeId: x.id || undefined, label: x.month ? `فاتورة ${x.month}${x.course ? ` — ${x.course}` : ''}` : 'الفواتير', remaining: Number(x.remaining) }))}
          {booklets.map((x) => row(`booklet-${x.id}`, 'book', `ملزمة ${x.course ?? ''}`, x.partial ? `متبقٍّ من ${formatNumber(Number(x.original))}` : null,
            Number(x.remaining), false, { kind: 'booklet', chargeId: x.id, label: `ملزمة ${x.course ?? ''}`, remaining: Number(x.remaining) }))}
          {booking ? row('booking', 'card', 'دفعة الحجز', booking.secures ? `تؤمّن ${booking.secures}` : null,
            Number(booking.remaining), false, { kind: 'booking', label: 'دفعة الحجز', remaining: Number(booking.remaining) }) : null}
          {canCollect && count > 1 ? (
            <TouchableOpacity onPress={() => onCollect({ kind: 'all', label: 'كل المستحقّات', remaining: owed })} accessibilityRole="button" activeOpacity={0.85}
              style={{ marginTop: spacing.sm, marginBottom: spacing.xs, minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.success, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
              <Icon name="success" size={18} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{`تحصيل الكل · ${formatNumber(owed)} ج.م`}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The collect form: how much (prefilled, editable — part-payment at the door is normal, with
 * «الكل» / «النصف» shortcuts) and what follows. Rendered inside a keyboard-aware SheetModal.
 */
export function CollectForm({ target, amount, onAmount, busy, onSubmit }: {
  target: CollectTarget; amount: string; onAmount: (v: string) => void; busy: boolean; onSubmit: () => void;
}) {
  const all = target.kind === 'all';
  const quick = all ? [] : [{ label: 'الكل', v: target.remaining }, { label: 'النصف', v: Math.round(target.remaining / 2) }];
  return (
    <View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>
        {`المستحقّ ${formatNumber(target.remaining)} ج.م${all ? '' : ' — عدّل المبلغ إن دفع جزءًا'}`}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TextInput
          value={amount}
          onChangeText={(v) => onAmount(v.replace(/[^0-9.]/g, ''))}
          editable={!all}
          keyboardType="numeric"
          placeholder="المبلغ بالجنيه"
          placeholderTextColor={colors.textTertiary}
          style={{ flex: 1, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 52, fontFamily: fonts.bold, fontSize: 22, color: all ? colors.textSecondary : colors.textPrimary, textAlign: 'center', backgroundColor: all ? colors.surfaceSunken : colors.surface }}
        />
        {quick.map((q) => {
          const on = Number(amount) === q.v;
          return (
            <TouchableOpacity key={q.label} onPress={() => onAmount(String(q.v))} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={{ paddingHorizontal: spacing.md, height: 52, justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, backgroundColor: on ? colors.brand : 'transparent' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? '#fff' : colors.brand }}>{q.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: spacing.sm }}>
        يُرسَل إيصال لولي الأمر، ويدخل المبلغ خزنتك ويُحتسب في التقارير المالية الآن.
      </Text>
      <TouchableOpacity
        onPress={onSubmit}
        disabled={busy || !(Number(amount) > 0)}
        accessibilityRole="button"
        style={{ marginTop: spacing.lg, minHeight: 50, borderRadius: radius.lg, backgroundColor: Number(amount) > 0 ? colors.success : colors.border, justifyContent: 'center', alignItems: 'center' }}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>تم التحصيل</Text>}
      </TouchableOpacity>
    </View>
  );
}
