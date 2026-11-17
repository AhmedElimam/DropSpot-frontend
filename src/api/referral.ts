import type { TFunction } from 'i18next';
import client from './client';
import { formatNumber } from '@/utils/format';

/**
 * «ادعُ معلّمًا» (founder 2026-11-17): a founding teacher owns a code like `CAIRO-58`. A teacher
 * they invite opens the link, signs up on the website, and gets a free trial plus a random
 * 30–80% off their first bill. Non-founding teachers get `{ available: false }`. The discount
 * range, trial length and ready share text are newer fields: an older server leaves them out,
 * so every one of them has a fallback here.
 *
 * The inviter's reward (founder 2026-11-17, second decision): no % any more (`reward_pct` is
 * always 0 and never shown). Each invited teacher who activates earns the inviter 100 free
 * teacher QR cards («كروت المدرّس»), kept in a stash («المخزن») with no expiry. The teacher
 * activates a stashed batch whenever they like; the cards are then made, sent to print, and
 * valid for a year from that day.
 */
export type ReferralRewardStatus = 'stashed' | 'activated';
export type ReferralBatchStatus = 'pending_delivery' | 'delivered';

export interface ReferralReward {
  id: number;
  cards?: number | null;
  status: ReferralRewardStatus;
  earned_at?: string | null;
  activated_at?: string | null;
  valid_until?: string | null;
  /** The printed batch's state once activated. */
  batch_status?: ReferralBatchStatus | null;
  /** First name of the invited teacher who earned it. */
  from_name?: string | null;
}

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
  /** Removed (always 0): never shown. */
  reward_pct?: number | null;
  /** Cards earned per invited teacher who activates. */
  reward_cards?: number | null;
  card_validity_months?: number | null;
  /** Stashed (not yet activated) batches. */
  stash_count?: number | null;
  stash?: ReferralReward[] | null;
  invited?: number | null;
  activated?: number | null;
  pending?: number | null;
}

export async function getReferral(): Promise<ReferralInfo> {
  const { data } = await client.get('/teacher/referral');
  const info = data?.data;
  return info && typeof info === 'object' ? { ...info, available: !!info.available && !!info.code } : { available: false };
}

export const REFERRAL_DEFAULTS = { min: 30, max: 80, trialDays: 14, cards: 100, validityMonths: 12 } as const;

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback);

/** What the invited teacher gets, with the fallbacks an older server needs. */
export function referralTerms(info: Pick<ReferralInfo, 'discount_min_pct' | 'discount_max_pct' | 'trial_days'>) {
  return {
    min: num(info.discount_min_pct, REFERRAL_DEFAULTS.min),
    max: num(info.discount_max_pct, REFERRAL_DEFAULTS.max),
    trialDays: num(info.trial_days, REFERRAL_DEFAULTS.trialDays),
  };
}

/** What the inviter earns per activated invitee, with the same fallbacks. */
export function referralReward(info: Pick<ReferralInfo, 'reward_cards' | 'card_validity_months'>) {
  return {
    cards: num(info.reward_cards, REFERRAL_DEFAULTS.cards),
    months: num(info.card_validity_months, REFERRAL_DEFAULTS.validityMonths),
  };
}

/** The stash as the page lists it: well-formed rows only, the ones still to activate first. */
export function referralStash(info: Pick<ReferralInfo, 'stash'>): ReferralReward[] {
  const rows = Array.isArray(info.stash) ? info.stash : [];
  const ok = rows.filter((r): r is ReferralReward => !!r && typeof r === 'object' && typeof r.id === 'number' && (r.status === 'stashed' || r.status === 'activated'));
  return [...ok.filter((r) => r.status === 'stashed'), ...ok.filter((r) => r.status === 'activated')];
}

/** Batches waiting in the stash: the server's count, else the stashed rows it sent. */
export function referralStashCount(info: Pick<ReferralInfo, 'stash' | 'stash_count'>): number {
  if (typeof info.stash_count === 'number' && Number.isFinite(info.stash_count) && info.stash_count >= 0) return Math.floor(info.stash_count);
  return referralStash(info).filter((r) => r.status === 'stashed').length;
}

/** The day a batch activated on `from` stays valid until (the confirm says it before the server does). */
export function rewardValidUntil(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  // 29 Feb + 12 months → 28 Feb, never 1 Mar.
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

/** Activate a stashed batch: the cards are made and sent to print. 409 REWARD_ALREADY_ACTIVE, 404. */
export async function activateReferralReward(id: number): Promise<{ message?: string; reward?: ReferralReward }> {
  const { data } = await client.post(`/teacher/referral/rewards/${id}/activate`);
  const out = data?.data;
  return out && typeof out === 'object' ? out : {};
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
