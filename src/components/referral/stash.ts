import type { TFunction } from 'i18next';
import { formatDateOnly, formatNumber } from '@/utils/format';
import { REFERRAL_DEFAULTS, rewardValidUntil, type ReferralReward } from '@/api/referral';

const DAY_MONTH = { day: 'numeric', month: 'long' } as const;
const DAY_MONTH_YEAR = { day: 'numeric', month: 'long', year: 'numeric' } as const;
const n = (v: number) => formatNumber(v, { maximumFractionDigits: 0 });

export type StashTone = 'waiting' | 'preparing' | 'delivered';

export interface StashRowLabels {
  /** «١٠٠ كارت QR» */
  title: string;
  /** «من منى · ١٧ نوفمبر» — who earned it and when; either part may be missing. */
  sub: string;
  /** Activated only: «اتفعّلت · صالحة لحد ٢٠ نوفمبر ٢٠٢٧». */
  validity: string | null;
  /** Activated only: «بنجهّزها» / «وصلت». */
  badge: string | null;
  tone: StashTone;
}

/** What one stash row says. Pure, so the wording is tested without a screen. */
export function stashRowLabels(item: ReferralReward, t: TFunction, fallbackCards: number = REFERRAL_DEFAULTS.cards): StashRowLabels {
  const cards = typeof item.cards === 'number' && item.cards > 0 ? item.cards : fallbackCards;
  const name = (item.from_name ?? '').trim();
  const earned = item.earned_at ? formatDateOnly(item.earned_at, DAY_MONTH) : '';
  const sub = [name ? t('referral.stash_from', { name }) : '', earned].filter(Boolean).join(' · ');
  const title = t('referral.stash_cards', { n: n(cards) });
  if (item.status !== 'activated') return { title, sub, validity: null, badge: null, tone: 'waiting' };

  const until = item.valid_until ? formatDateOnly(item.valid_until, DAY_MONTH_YEAR) : '';
  const validity = until ? t('referral.stash_valid_until', { date: until }) : t('referral.stash_activated');
  const delivered = item.batch_status === 'delivered';
  return {
    title, sub, validity,
    badge: t(delivered ? 'referral.stash_delivered' : 'referral.stash_preparing'),
    tone: delivered ? 'delivered' : 'preparing',
  };
}

/** «سنة» for twelve months, «سنتين» for 24, else «٦ شهور». */
export function validityPeriod(months: number, t: TFunction): string {
  if (months === 12) return t('referral.period_year');
  if (months === 24) return t('referral.period_two_years');
  return t('referral.period_months', { n: n(months) });
}

/** The confirm before «فعّلها الآن»: the year starts today, and until when it runs. */
export function activateConfirmText(item: ReferralReward, months: number, t: TFunction, now: Date = new Date(), fallbackCards: number = REFERRAL_DEFAULTS.cards): string {
  const cards = typeof item.cards === 'number' && item.cards > 0 ? item.cards : fallbackCards;
  return t('referral.activate_confirm', {
    cards: n(cards),
    period: validityPeriod(months, t),
    date: formatDateOnly(rewardValidUntil(now, months), DAY_MONTH_YEAR),
  });
}
