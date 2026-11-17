import type { TFunction } from 'i18next';

jest.mock('@/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/utils/format', () => ({
  formatNumber: (n: number) => String(n),
  // ISO day in, a readable stand-in out: «17 Nov» / «20 Nov 2027».
  formatDateOnly: (d: string | Date, o: { year?: string }) => {
    const iso = (typeof d === 'string' ? new Date(d) : d).toISOString().slice(0, 10);
    return o.year ? `D(${iso})` : `d(${iso.slice(5)})`;
  },
}));

import { activateConfirmText, stashRowLabels, validityPeriod } from '../stash';

const t = ((k: string, o?: Record<string, unknown>) => (o ? `${k}|${JSON.stringify(o)}` : k)) as unknown as TFunction;

describe('referral stash labels', () => {
  it('a stashed batch: its cards, who earned it and when, nothing about validity', () => {
    const l = stashRowLabels({ id: 7, cards: 100, status: 'stashed', earned_at: '2026-11-17', from_name: ' منى ' }, t);
    expect(l.title).toBe('referral.stash_cards|{"n":"100"}');
    expect(l.sub).toBe('referral.stash_from|{"name":"منى"} · d(11-17)');
    expect(l).toMatchObject({ validity: null, badge: null, tone: 'waiting' });
  });

  it('leaves out a missing name or date, and falls back to the default card count', () => {
    expect(stashRowLabels({ id: 1, status: 'stashed', earned_at: '2026-11-17', from_name: null }, t).sub).toBe('d(11-17)');
    expect(stashRowLabels({ id: 1, status: 'stashed', from_name: 'منى' }, t).sub).toBe('referral.stash_from|{"name":"منى"}');
    expect(stashRowLabels({ id: 1, status: 'stashed' }, t).sub).toBe('');
    expect(stashRowLabels({ id: 1, cards: null, status: 'stashed' }, t, 120).title).toBe('referral.stash_cards|{"n":"120"}');
  });

  it('an activated batch: valid until, and «بنجهّزها» until it is delivered', () => {
    const base = { id: 7, cards: 100, status: 'activated' as const, earned_at: '2026-11-17', activated_at: '2026-11-20', valid_until: '2027-11-20' };
    expect(stashRowLabels({ ...base, batch_status: 'pending_delivery' }, t)).toMatchObject({
      validity: 'referral.stash_valid_until|{"date":"D(2027-11-20)"}', badge: 'referral.stash_preparing', tone: 'preparing',
    });
    expect(stashRowLabels({ ...base, batch_status: null }, t).tone).toBe('preparing');
    expect(stashRowLabels({ ...base, batch_status: 'delivered' }, t)).toMatchObject({ badge: 'referral.stash_delivered', tone: 'delivered' });
    expect(stashRowLabels({ ...base, valid_until: null }, t).validity).toBe('referral.stash_activated');
  });

  it('says a year as a year', () => {
    expect(validityPeriod(12, t)).toBe('referral.period_year');
    expect(validityPeriod(24, t)).toBe('referral.period_two_years');
    expect(validityPeriod(6, t)).toBe('referral.period_months|{"n":"6"}');
  });

  it('the confirm names the cards, the period and the last day', () => {
    const now = new Date(2026, 10, 20, 12);
    expect(activateConfirmText({ id: 7, cards: 100, status: 'stashed' }, 12, t, now))
      .toBe('referral.activate_confirm|{"cards":"100","period":"referral.period_year","date":"D(2027-11-20)"}');
  });
});
