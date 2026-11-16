import type { TFunction } from 'i18next';
import { upcomingBill, upcomingBillLine, billDiscount, discountChip } from '../upcomingBill';
import { subscriptionSheet } from '../receipt';
import type { SubscriptionState } from '@/api/subscription';

jest.mock('@/utils/format', () => ({
  formatDate: (d: string) => d,
  formatDateOnly: (d: string) => `day(${d})`,
  formatNumber: (n: number) => String(n),
}));
jest.mock('@/components/rose/RoseStamp', () => ({}));

const t = ((k: string, o?: Record<string, unknown>) => (o ? `${k}|${JSON.stringify(o)}` : k)) as unknown as TFunction;
const base: SubscriptionState = {
  phase: 'trial', blocked: false, usable: true, plan: null, price: null, standard_price: null, late_price: null,
  prices: { term: 1000, year: 1600, late_term: 1500, late_year: 2200, trial_days: 14, grace_days: 30, block_days: 45 },
  due_at: null, late_at: null, block_at: null, expires_at: null, trial_ends_at: '2026-12-01', exempt_until: null, exempt_reason: null,
  days_left: 3, subscription_id: null,
};
const upcoming = { due_at: '2026-12-01', discount_pct: 55, term: { list: 1000, price: 450 }, year: { list: 1600, price: 720 } };

describe('the upcoming bill', () => {
  it('is there only in the trial or while the first bill is on its way', () => {
    expect(upcomingBill({ ...base, upcoming })?.term.price).toBe(450);
    expect(upcomingBill({ ...base, phase: 'lapsed', upcoming })?.pct).toBe(55);
    for (const phase of ['pending', 'late', 'active', 'exempt', 'blocked'] as const) expect(upcomingBill({ ...base, phase, upcoming })).toBeNull();
    expect(upcomingBill({ ...base, upcoming: null })).toBeNull();
    expect(upcomingBill({ ...base })).toBeNull();
    expect(upcomingBill(null)).toBeNull();
  });

  it('falls back to the state-level discount, and reads 0 as none', () => {
    expect(upcomingBill({ ...base, discount_pct: 40, upcoming: { ...upcoming, discount_pct: null } })?.pct).toBe(40);
    expect(upcomingBill({ ...base, upcoming: { ...upcoming, discount_pct: 0 } })?.pct).toBeNull();
  });

  it('says the discounted term price, the % and the day', () => {
    expect(upcomingBillLine({ ...base, upcoming }, t)).toBe('subscription.upcoming_line_discount|{"price":"450","pct":"55","date":"day(2026-12-01)"}');
  });

  it('says the year price when the teacher picked the year', () => {
    expect(upcomingBillLine({ ...base, plan: 'annual', upcoming }, t)).toContain('"price":"720"');
  });

  it('without a discount: the list price and the plan', () => {
    const plain = { ...upcoming, discount_pct: null, term: { list: 1000, price: 1000 }, year: { list: 1600, price: 1600 } };
    expect(upcomingBillLine({ ...base, upcoming: plain }, t)).toBe('subscription.upcoming_line|{"price":"1000","per":"subscription.per_term","date":"day(2026-12-01)"}');
    expect(upcomingBillLine({ ...base, upcoming: null }, t)).toBeNull();
  });
});

describe('the discount on an open bill', () => {
  const pending: SubscriptionState = { ...base, phase: 'pending', plan: 'term', price: 450, standard_price: 1000, due_at: '2026-12-01', late_at: '2026-12-31' };

  it('shows when the standard price is above the price', () => {
    expect(billDiscount(pending)).toEqual({ list: 1000, price: 450, pct: 55, amount: 550, welcome: true, label: null });
    expect(billDiscount({ ...pending, discount_pct: 45 })?.pct).toBe(45);
  });

  it('takes the % and the amount from the server discounts', () => {
    const d = billDiscount(pending, [{ kind: 'referral_welcome', label: 'خصم ترحيب بإحالة', pct: 54, amount: 551 }]);
    expect(d).toMatchObject({ pct: 54, amount: 551, welcome: true });
    expect(billDiscount(pending, [{ kind: 'manual', label: 'خصم خاص', pct: 55, amount: 550 }])).toMatchObject({ welcome: false, label: 'خصم خاص' });
  });

  it('never on a late bill, a full-price bill or another phase', () => {
    expect(billDiscount({ ...pending, phase: 'late', price: 1500 })).toBeNull();
    expect(billDiscount({ ...pending, price: 1000 })).toBeNull();
    expect(billDiscount({ ...pending, standard_price: null })).toBeNull();
    expect(billDiscount({ ...pending, phase: 'trial' })).toBeNull();
  });

  it('puts the list price and the discount on her bill sheet', () => {
    const sheet = subscriptionSheet(pending, t)!;
    const labels = sheet.rows.map((r) => r.label);
    expect(labels).toEqual(['subscription.row_plan', 'subscription.row_list_price', 'subscription.row_welcome_discount', 'subscription.row_amount_due', 'subscription.row_issued', 'subscription.row_standard_until']);
    expect(subscriptionSheet({ ...pending, price: 1000 }, t)!.rows.map((r) => r.label)).not.toContain('subscription.row_list_price');
  });

  it('names the welcome chip, or the server label for another kind', () => {
    expect(discountChip(45, t)).toBe('subscription.welcome_chip|{"pct":"45"}');
    expect(discountChip(20, t, 'خصم خاص')).toBe('خصم خاص 20٪');
  });
});
