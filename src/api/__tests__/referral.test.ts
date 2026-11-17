import type { TFunction } from 'i18next';

jest.mock('@/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/utils/format', () => ({ formatNumber: (n: number) => String(n) }));

import client from '@/api/client';
import {
  activateReferralReward, getReferral, referralLinks, referralReward, referralShareText, referralStash, referralStashCount, referralTerms, rewardValidUntil,
} from '@/api/referral';

const t = ((k: string, o?: Record<string, unknown>) => `${k}|${JSON.stringify(o)}`) as unknown as TFunction;
const get = client.get as jest.Mock;
const post = client.post as jest.Mock;

describe('referral', () => {
  it('reads a founding teacher\'s code and a non-founding teacher\'s «not available»', async () => {
    get.mockResolvedValueOnce({ data: { data: { available: true, code: 'CAIRO-58', url: 'https://drosspot.app/join/CAIRO-58', invited: 3 } } });
    expect(await getReferral()).toMatchObject({ available: true, code: 'CAIRO-58', invited: 3 });
    get.mockResolvedValueOnce({ data: { data: { available: false } } });
    expect(await getReferral()).toEqual({ available: false });
    get.mockResolvedValueOnce({ data: { data: { available: true } } });
    expect((await getReferral()).available).toBe(false);
    expect(get).toHaveBeenCalledWith('/teacher/referral');
  });

  it('falls back to 30–80% and 14 days when an older server leaves the terms out', () => {
    expect(referralTerms({})).toEqual({ min: 30, max: 80, trialDays: 14 });
    expect(referralTerms({ discount_min_pct: 25, discount_max_pct: 70, trial_days: 21 })).toEqual({ min: 25, max: 70, trialDays: 21 });
    expect(referralTerms({ discount_min_pct: null, discount_max_pct: 0, trial_days: undefined })).toEqual({ min: 30, max: 80, trialDays: 14 });
  });

  it('sends the server\'s text, else the WhatsApp text, else one built from the code and link', () => {
    const info = { available: true, code: 'CAIRO-58', url: 'https://drosspot.app/join/CAIRO-58' };
    expect(referralShareText({ ...info, share_text: ' جاهز ' }, t)).toBe('جاهز');
    expect(referralShareText({ ...info, whatsapp_text: 'واتساب' }, t)).toBe('واتساب');
    expect(referralShareText(info, t)).toBe('referral.share_fallback|{"code":"CAIRO-58","url":"https://drosspot.app/join/CAIRO-58","days":"14","min":"30","max":"80"}');
  });

  it('builds each app\'s link, the SMS body per platform', () => {
    const l = referralLinks('ادخل & سجّل', 'https://drosspot.app/join/CAIRO-58', 'ios');
    expect(l.whatsapp).toBe(`whatsapp://send?text=${encodeURIComponent('ادخل & سجّل')}`);
    expect(l.messenger).toBe('fb-messenger://share/?link=https%3A%2F%2Fdrosspot.app%2Fjoin%2FCAIRO-58');
    expect(l.sms.startsWith('sms:&body=')).toBe(true);
    expect(referralLinks('x', 'u', 'android').sms).toBe('sms:?body=x');
  });

  it('rewards 100 QR cards valid 12 months when an older server leaves the reward out', () => {
    expect(referralReward({})).toEqual({ cards: 100, months: 12 });
    expect(referralReward({ reward_cards: 50, card_validity_months: 6 })).toEqual({ cards: 50, months: 6 });
    expect(referralReward({ reward_cards: 0, card_validity_months: null })).toEqual({ cards: 100, months: 12 });
  });

  it('lists the stash with what is still to activate first, and drops malformed rows', () => {
    const stash = [
      { id: 1, status: 'activated', cards: 100 },
      { id: 2, status: 'stashed', cards: 100 },
      { id: 3, status: 'weird' },
      null,
      { status: 'stashed' },
      { id: 4, status: 'stashed', cards: 100 },
    ] as never;
    expect(referralStash({ stash }).map((r) => r.id)).toEqual([2, 4, 1]);
    expect(referralStash({})).toEqual([]);
    expect(referralStash({ stash: 'nope' as never })).toEqual([]);
    // The server's count first, else the stashed rows.
    expect(referralStashCount({ stash, stash_count: 5 })).toBe(5);
    expect(referralStashCount({ stash })).toBe(2);
    expect(referralStashCount({ stash_count: null })).toBe(0);
  });

  it('a year from the activation day, the end of February kept in February', () => {
    const d = rewardValidUntil(new Date(2026, 10, 20), 12);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2027, 10, 20]);
    const leap = rewardValidUntil(new Date(2028, 1, 29), 12);
    expect([leap.getFullYear(), leap.getMonth(), leap.getDate()]).toEqual([2029, 1, 28]);
    const jan = rewardValidUntil(new Date(2026, 0, 31), 1);
    expect([jan.getFullYear(), jan.getMonth(), jan.getDate()]).toEqual([2026, 1, 28]);
  });

  it('activates a stashed batch and returns the server\'s message and row', async () => {
    post.mockResolvedValueOnce({ data: { data: { message: 'اتفعّلت', reward: { id: 7, status: 'activated' } } } });
    expect(await activateReferralReward(7)).toEqual({ message: 'اتفعّلت', reward: { id: 7, status: 'activated' } });
    expect(post).toHaveBeenCalledWith('/teacher/referral/rewards/7/activate');
    post.mockResolvedValueOnce({ data: {} });
    expect(await activateReferralReward(8)).toEqual({});
  });
});

