import type { TFunction } from 'i18next';
import type { SubscriptionDiscount, SubscriptionState, UpcomingPlanPrice } from '@/api/subscription';
import { formatDateOnly, formatNumber } from '@/utils/format';

/**
 * «فاتورتك القادمة» (founder 2026-11-17): what a teacher in the trial — or waiting for the first
 * bill — will be billed, and when; and, once that bill is open, the welcome discount taken off
 * it. Pure, so the settings card, the subscription panel and the tests read the same numbers.
 */
export interface UpcomingBill {
  dueAt: string;
  /** The welcome discount waiting for the first bill, or null when there is none. */
  pct: number | null;
  term: UpcomingPlanPrice;
  year: UpcomingPlanPrice;
}

const positive = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const n = (v: number) => formatNumber(v, { maximumFractionDigits: 0 });

export function upcomingBill(sub: SubscriptionState | null | undefined): UpcomingBill | null {
  if (!sub || (sub.phase !== 'trial' && sub.phase !== 'lapsed')) return null;
  const u = sub.upcoming;
  if (!u?.due_at || !u.term || !u.year) return null;
  return { dueAt: u.due_at, pct: positive(u.discount_pct) ?? positive(sub.discount_pct), term: u.term, year: u.year };
}

/** True when this plan's first bill is below its list price. */
export function isDiscounted(p: UpcomingPlanPrice): boolean {
  return Number(p.price) < Number(p.list);
}

/**
 * The settings card's one line: «فاتورتك القادمة: ٤٥٠ ج.م بعد خصم ٤٥٪ — ١ ديسمبر», or without a
 * discount «فاتورتك القادمة: ١٬٠٠٠ ج.م للترم — ١ ديسمبر». The plan the teacher picked, else the term.
 */
export function upcomingBillLine(sub: SubscriptionState | null | undefined, t: TFunction): string | null {
  const bill = upcomingBill(sub);
  if (!bill) return null;
  const annual = sub?.plan === 'annual';
  const plan = annual ? bill.year : bill.term;
  const date = formatDateOnly(bill.dueAt, { day: 'numeric', month: 'long' });
  if (bill.pct != null && isDiscounted(plan)) {
    return t('subscription.upcoming_line_discount', { price: n(plan.price), pct: n(bill.pct), date });
  }
  return t('subscription.upcoming_line', { price: n(plan.price), per: t(annual ? 'subscription.per_year' : 'subscription.per_term'), date });
}

export interface BillDiscount {
  list: number;
  price: number;
  pct: number;
  amount: number;
  /** The invited teacher's welcome discount (the only kind today). */
  welcome: boolean;
  /** The server's own name for any other kind. */
  label: string | null;
}

/** The discount on an OPEN bill at the standard price: `standard_price` above `price`. Never on a late one. */
export function billDiscount(sub: SubscriptionState | null | undefined, discounts: SubscriptionDiscount[] = []): BillDiscount | null {
  if (!sub || sub.phase !== 'pending') return null;
  const list = positive(sub.standard_price);
  const price = Number(sub.price ?? NaN);
  if (list == null || !Number.isFinite(price) || price < 0 || !(list > price)) return null;
  const d = discounts.find((x) => x.kind === 'referral_welcome') ?? discounts[0];
  const pct = positive(sub.discount_pct) ?? positive(d?.pct) ?? Math.round((1 - price / list) * 100);
  const amount = positive(d?.amount) ?? list - price;
  return { list, price, pct, amount, welcome: !d || d.kind === 'referral_welcome', label: d?.label?.trim() || null };
}

/** The chip on a discounted bill: «خصم الترحيب ٤٥٪». */
export function discountChip(pct: number, t: TFunction, label?: string | null): string {
  return label ? `${label} ${n(pct)}٪` : t('subscription.welcome_chip', { pct: n(pct) });
}
