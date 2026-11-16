import type { TFunction } from 'i18next';
import client from './client';
import { formatNumber } from '@/utils/format';

/**
 * «ادعُ معلّمًا» (founder 2026-11-17): a founding teacher owns a code like `CAIRO-58`. A teacher
 * they invite opens the link, signs up on the website, and gets a free trial plus a random
 * 30–80% off their first bill; the inviter is rewarded later. Non-founding teachers get
 * `{ available: false }`. The discount range, trial length and ready share text are newer
 * fields: an older server leaves them out, so every one of them has a fallback here.
 */
export interface ReferralInfo {
  available: boolean;
  code?: string | null;
  url?: string | null;
  share_text?: string | null;
  whatsapp_text?: string | null;
  whatsapp_url?: string | null;
  discount_min_pct?: number | null;
  discount_max_pct?: number | null;
  trial_days?: number | null;
  reward_pct?: number | null;
  invited?: number | null;
  activated?: number | null;
  pending?: number | null;
}

export async function getReferral(): Promise<ReferralInfo> {
  const { data } = await client.get('/teacher/referral');
  const info = data?.data;
  return info && typeof info === 'object' ? { ...info, available: !!info.available && !!info.code } : { available: false };
}

export const REFERRAL_DEFAULTS = { min: 30, max: 80, trialDays: 14 } as const;

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback);

/** What the invited teacher gets, with the fallbacks an older server needs. */
export function referralTerms(info: Pick<ReferralInfo, 'discount_min_pct' | 'discount_max_pct' | 'trial_days'>) {
  return {
    min: num(info.discount_min_pct, REFERRAL_DEFAULTS.min),
    max: num(info.discount_max_pct, REFERRAL_DEFAULTS.max),
    trialDays: num(info.trial_days, REFERRAL_DEFAULTS.trialDays),
  };
}

/** The message every channel sends: the server's text, else one built here from the code and link. */
export function referralShareText(info: ReferralInfo, t: TFunction): string {
  const ready = (info.share_text || info.whatsapp_text || '').trim();
  if (ready) return ready;
  const terms = referralTerms(info);
  const n = (v: number) => formatNumber(v, { maximumFractionDigits: 0 });
  return t('referral.share_fallback', { code: info.code ?? '', url: info.url ?? '', days: n(terms.trialDays), min: n(terms.min), max: n(terms.max) });
}

/** The deep links each share button tries first. `os` is Platform.OS. */
export function referralLinks(text: string, url: string, os: string) {
  const body = encodeURIComponent(text);
  return {
    whatsapp: `whatsapp://send?text=${body}`,
    whatsappWeb: `https://wa.me/?text=${body}`,
    messenger: `fb-messenger://share/?link=${encodeURIComponent(url)}`,
    // iOS reads the body after `&`, Android after `?`.
    sms: os === 'ios' ? `sms:&body=${body}` : `sms:?body=${body}`,
  };
}
