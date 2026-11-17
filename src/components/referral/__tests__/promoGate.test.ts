import { PROMO_EVERY_MS, parsePromoStamp, promoAudience, promoDue, promoKey, tickerSteps } from '../promoGate';

const NOW = Date.UTC(2026, 10, 17, 10, 0, 0);
const DAY = 24 * 60 * 60_000;

describe('referral promo gate', () => {
  it('is due the first time and once a full week has passed, not before', () => {
    expect(promoDue(null, NOW)).toBe(true);
    expect(promoDue(NOW - PROMO_EVERY_MS, NOW)).toBe(true);
    expect(promoDue(NOW - 8 * DAY, NOW)).toBe(true);
    expect(promoDue(NOW - PROMO_EVERY_MS + 1, NOW)).toBe(false);
    expect(promoDue(NOW - DAY, NOW)).toBe(false);
    expect(promoDue(NOW, NOW)).toBe(false);
  });

  it('ignores a stamp written under a clock set far ahead', () => {
    expect(promoDue(NOW + 2 * DAY, NOW)).toBe(true);
    // A few hours ahead is a time-zone wobble, not a broken clock.
    expect(promoDue(NOW + 3 * 60 * 60_000, NOW)).toBe(false);
  });

  it('reads the stored stamp, anything unreadable as never shown', () => {
    expect(parsePromoStamp(String(NOW))).toBe(NOW);
    expect(parsePromoStamp(null)).toBeNull();
    expect(parsePromoStamp('')).toBeNull();
    expect(parsePromoStamp('garbage')).toBeNull();
    expect(parsePromoStamp('-5')).toBeNull();
    expect(promoKey(42)).toBe('referral_promo_at:42');
  });

  it('is for a founding teacher\'s own account only', () => {
    expect(promoAudience({ role: 'teacher', founding: true, impersonating: false })).toBe(true);
    expect(promoAudience({ role: 'teacher', founding: false, impersonating: false })).toBe(false);
    expect(promoAudience({ role: 'teacher', founding: undefined, impersonating: false })).toBe(false);
    expect(promoAudience({ role: 'assistant', founding: true, impersonating: false })).toBe(false);
    expect(promoAudience({ role: 'teacher', founding: true, impersonating: true })).toBe(false);
    expect(promoAudience({ role: null, founding: true, impersonating: false })).toBe(false);
  });

  it('counts 30 → 80 in a few steps and settles on the top figure', () => {
    expect(tickerSteps(30, 80)).toEqual([30, 40, 50, 60, 70, 80]);
    expect(tickerSteps(25, 70)).toEqual([25, 34, 43, 52, 61, 70]);
    expect(tickerSteps(30, 32)).toEqual([30, 31, 32]);
    expect(tickerSteps(80, 80)).toEqual([80]);
    expect(tickerSteps(80, 30)).toEqual([30]);
  });
});
