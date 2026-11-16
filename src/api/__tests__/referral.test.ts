import type { TFunction } from 'i18next';

jest.mock('@/api/client', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('@/utils/format', () => ({ formatNumber: (n: number) => String(n) }));

import client from '@/api/client';
import { getReferral, referralLinks, referralShareText, referralTerms } from '@/api/referral';

const t = ((k: string, o?: Record<string, unknown>) => `${k}|${JSON.stringify(o)}`) as unknown as TFunction;
const get = client.get as jest.Mock;

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
});
