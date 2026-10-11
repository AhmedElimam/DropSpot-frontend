import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { formatDayDate, formatNumber } from '@/utils/format';
import { collectStudentCharge, type StudentDetail } from '@/api/students';
import { isQueued } from '@/api/offlineQueue';
import { Surface } from '@/ui/surfaces';

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
    let queued = false;
    for (const k of kinds) if (isQueued(await collectStudentCharge(studentId, k))) queued = true;
    if (queued) return i18n.t('offline.queued');
    return i18n.t('student_profile_ui.collected_all_receipt', { amount: formatNumber(target.remaining) });
  }
  const partial = amount < target.remaining - 0.001;
  const r = await collectStudentCharge(studentId, target.kind, target.chargeId, partial ? amount : undefined);
  if (isQueued(r)) return r.message;
  return Number(r.remaining) > 0
    ? i18n.t('student_profile_ui.collected_partial', { collected: formatNumber(Number(r.collected)), remaining: formatNumber(Number(r.remaining)) })
    : i18n.t('student_profile_ui.collected_what_receipt', { what: r.what, collected: formatNumber(Number(r.collected)) });
}

/** The amount typed for a target, or the reason it cannot be collected. */
export function parseCollectAmount(text: string, target: CollectTarget): { amount: number } | { error: string } {
  const amount = Number(text.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0 || amount > target.remaining + 0.001) {
    return { error: i18n.t('student_profile_ui.amount_between', { max: formatNumber(target.remaining) }) };
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
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: overdue ? colors.danger : colors.textPrimary }}>{t('student_profile_ui.egp_amount', { amount: formatNumber(remaining) })}</Text>
      {canCollect ? (
        <Surface id="teacher.student_profile.dues_row_collect_button">
        <TouchableOpacity onPress={() => onCollect(target)} accessibilityRole="button" activeOpacity={0.85}
          style={{ backgroundColor: colors.success, borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: spacing.md }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: '#fff' }}>{t('collections.collect')}</Text>
        </TouchableOpacity>
        </Surface>
      ) : null}
    </View>
  );

  return (
    <Surface id="teacher.student_profile.dues_card">
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: b.has_pending ? tone : colors.border, overflow: 'hidden', ...shadows.sm }}>
      <Surface id="teacher.student_profile.dues_summary">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: toneBg }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="money" size={24} color={tone} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{b.has_pending ? t('teacher.billing_pending') : t('teacher.billing_clear')}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, color: tone }}>{b.has_pending ? t('student_profile_ui.egp_amount', { amount: formatNumber(owed) }) : '✓'}</Text>
          {b.has_overdue ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.danger }}>{`${t('teacher.billing_overdue')} · ${t('student_profile_ui.egp_amount', { amount: formatNumber(Number(b.overdue_amount)) })}`}</Text> : null}
          {b.override_active ? (
            <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Badge label={t('teacher.billing_override_active')} variant="info" size="sm" />
              {b.override_expires_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('teacher.override_until', { date: formatDayDate(b.override_expires_at) })}</Text> : null}
            </View>
          ) : null}
        </View>
      </View>
      </Surface>
      {count > 0 ? (
        <Surface id="teacher.student_profile.dues_lines">
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          {bills.map((x) => row(`bill-${x.id}`, 'money', x.month ? t('student_profile_ui.bill_month', { month: x.month }) : t('student_profile_ui.cycle_bill'),
            [x.course, Number(x.paid) > 0 ? t('student_profile_ui.paid_of', { paid: formatNumber(Number(x.paid)), total: formatNumber(Number(x.amount)) }) : null].filter(Boolean).join(' · ') || null,
            Number(x.remaining), x.overdue,
            { kind: 'bill', chargeId: x.id || undefined, label: x.month ? `${t('student_profile_ui.bill_month', { month: x.month })}${x.course ? ` — ${x.course}` : ''}` : t('nav.invoices'), remaining: Number(x.remaining) }))}
          {booklets.map((x) => row(`booklet-${x.id}`, 'book', t('student_profile_ui.booklet_of', { course: x.course ?? '' }), x.partial ? t('student_profile_ui.remaining_of', { amount: formatNumber(Number(x.original)) }) : null,
            Number(x.remaining), false, { kind: 'booklet', chargeId: x.id, label: t('student_profile_ui.booklet_of', { course: x.course ?? '' }), remaining: Number(x.remaining) }))}
          {booking ? row('booking', 'card', t('teacher.due_booking'), booking.secures ? t('student_profile_ui.secures', { what: booking.secures }) : null,
            Number(booking.remaining), false, { kind: 'booking', label: t('teacher.due_booking'), remaining: Number(booking.remaining) }) : null}
          {canCollect && count > 1 ? (
            <Surface id="teacher.student_profile.collect_all_button">
            <TouchableOpacity onPress={() => onCollect({ kind: 'all', label: t('student_profile_ui.all_dues'), remaining: owed })} accessibilityRole="button" activeOpacity={0.85}
              style={{ marginTop: spacing.sm, marginBottom: spacing.xs, minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.success, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
              <Icon name="success" size={18} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('student_profile_ui.collect_all_amount', { amount: formatNumber(owed) })}</Text>
            </TouchableOpacity>
            </Surface>
          ) : null}
        </View>
        </Surface>
      ) : null}
    </View>
    </Surface>
  );
}
