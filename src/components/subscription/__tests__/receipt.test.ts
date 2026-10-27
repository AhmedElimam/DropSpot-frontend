import type { TFunction } from 'i18next';
import { subscriptionSheet } from '../receipt';
import type { SubscriptionState } from '@/api/subscription';

jest.mock('@/utils/format', () => ({ formatDate: (d: string) => d, formatNumber: (n: number) => String(n) }));
jest.mock('@/components/rose/RoseStamp', () => ({}));

const t = ((k: string) => k) as unknown as TFunction;
const base: SubscriptionState = {
  phase: 'trial', blocked: false, usable: true, plan: 'term', price: 1000, standard_price: 1000, late_price: 1500,
  prices: { term: 1000, year: 1600, late_term: 1500, late_year: 2200, trial_days: 14, grace_days: 30, block_days: 45 },
  due_at: null, late_at: null, block_at: null, expires_at: null, trial_ends_at: null, exempt_until: null, exempt_reason: null,
  days_left: 3, subscription_id: null,
};

describe('her subscription sheet', () => {
  it('stamps a paid term green with its paid and until dates', () => {
    const s = subscriptionSheet({ ...base, phase: 'active', paid_at: '2026-10-09', started_at: '2026-10-05', expires_at: '2027-02-05' }, t)!;
    expect(s.kind).toBe('paid');
    expect(s.ink).toBe('green');
    expect(s.rows.map((r) => r.label)).toEqual(expect.arrayContaining(['subscription.row_paid_on', 'subscription.row_until']));
    expect(s.rows.find((r) => r.label === 'subscription.row_until')?.value).toBe('2027-02-05');
  });

  it('stamps an exemption green; a far date reads «for life»; a founding teacher is named', () => {
    const life = subscriptionSheet({ ...base, phase: 'exempt', exempt_until: '2099-12-31', exempt_reason: 'شراكة' }, t)!;
    expect(life.ink).toBe('green');
    expect(life.rows.find((r) => r.label === 'subscription.row_exempt_until')?.value).toBe('subscription.lifetime');
    expect(life.rows[0].value).toBe('subscription.exempt_kind_admin');
    const dated = subscriptionSheet({ ...base, phase: 'exempt', exempt_until: '2027-04-25', exempt_reason: 'founding' }, t)!;
    expect(dated.rows[0].value).toBe('subscription.exempt_kind_founding');
    expect(dated.rows[1].value).toBe('2027-04-25');
  });

  it('stamps an open bill navy and a late one red', () => {
    expect(subscriptionSheet({ ...base, phase: 'pending' }, t)?.ink).toBe('navy');
    expect(subscriptionSheet({ ...base, phase: 'late' }, t)?.ink).toBe('red');
  });

  it('has no sheet for a trial, a bill on its way, a walled account or nothing', () => {
    for (const phase of ['trial', 'lapsed', 'blocked'] as const) expect(subscriptionSheet({ ...base, phase }, t)).toBeNull();
    expect(subscriptionSheet(null, t)).toBeNull();
  });
});
