import type { TFunction } from 'i18next';
import { isLifetimeExemption, type SubscriptionState } from '@/api/subscription';
import type { StampInk } from '@/components/rose/RoseStamp';
import { formatDate, formatNumber } from '@/utils/format';

/**
 * The subscription as a sheet in مدام روز's book (founder 2026-10-25): a receipt for a paid
 * term, a note for an exemption, a bill when one is open — with the ink of her stamp and the
 * word on it. One shape for her popup at app open and the card in settings, so they never
 * disagree. Null for the phases that have no sheet yet (trial, waiting for the bill, walled).
 */
export interface SubscriptionSheet {
  kind: 'paid' | 'exempt' | 'due' | 'late';
  ink: StampInk;
  word: string;
  title: string;
  /** Her line on the popup. */
  line: string;
  rows: { label: string; value: string; strong?: boolean }[];
}

export function subscriptionSheet(sub: SubscriptionState | null | undefined, t: TFunction, female = false): SubscriptionSheet | null {
  if (!sub) return null;
  const day = (d: string | null | undefined) => (d ? formatDate(d) : '—');
  const money = (v: number | null | undefined) => `${formatNumber(Number(v ?? 0), { maximumFractionDigits: 0 })} ${t('subscription.egp')}`;
  const plan = sub.plan === 'annual' ? t('subscription.plan_year') : t('subscription.plan_term');

  switch (sub.phase) {
    case 'active':
      return {
        kind: 'paid', ink: 'green', word: t('subscription.stamp_paid'), title: t('subscription.status_title_paid'),
        line: t('subscription.rose_paid', { date: day(sub.expires_at) }),
        rows: [
          { label: t('subscription.row_plan'), value: plan },
          { label: t('subscription.row_amount_paid'), value: money(sub.price), strong: true },
          ...(sub.paid_at ? [{ label: t('subscription.row_paid_on'), value: day(sub.paid_at) }] : []),
          ...(sub.started_at ? [{ label: t('subscription.row_from'), value: day(sub.started_at) }] : []),
          { label: t('subscription.row_until'), value: day(sub.expires_at), strong: true },
        ],
      };
    case 'exempt': {
      const lifetime = isLifetimeExemption(sub);
      const kind = sub.exempt_reason === 'founding' ? 'founding' : sub.exempt_reason === 'distinguished' ? 'distinguished' : 'admin';
      return {
        kind: 'exempt', ink: 'green', word: t('subscription.stamp_exempt'), title: t('subscription.status_title_exempt'),
        line: lifetime ? t('subscription.rose_exempt') : t('subscription.rose_exempt_until', { date: day(sub.exempt_until) }),
        rows: [
          { label: t('subscription.row_exempt_for'), value: t(kind === 'founding' && female ? 'subscription.exempt_kind_founding_f' : `subscription.exempt_kind_${kind}`) },
          { label: t('subscription.row_exempt_until'), value: lifetime ? t('subscription.lifetime') : day(sub.exempt_until), strong: true },
        ],
      };
    }
    case 'pending':
      return {
        kind: 'due', ink: 'navy', word: t('subscription.stamp_due'), title: t('subscription.status_title_bill'),
        line: t('subscription.rose_due', { date: day(sub.late_at) }),
        rows: [
          { label: t('subscription.row_plan'), value: plan },
          { label: t('subscription.row_amount_due'), value: money(sub.price), strong: true },
          { label: t('subscription.row_issued'), value: day(sub.due_at) },
          { label: t('subscription.row_standard_until'), value: day(sub.late_at), strong: true },
        ],
      };
    case 'late':
      return {
        kind: 'late', ink: 'red', word: t('subscription.stamp_late'), title: t('subscription.status_title_bill'),
        line: t('subscription.rose_late', { date: day(sub.block_at) }),
        rows: [
          { label: t('subscription.row_plan'), value: plan },
          { label: t('subscription.row_amount_due'), value: money(sub.price), strong: true },
          { label: t('subscription.row_issued'), value: day(sub.due_at) },
          { label: t('subscription.row_block_from'), value: day(sub.block_at), strong: true },
        ],
      };
    default:
      return null;
  }
}
