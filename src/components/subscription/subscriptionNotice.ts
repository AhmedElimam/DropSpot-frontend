import type { TFunction } from 'i18next';
import { create } from 'zustand';
import type { SubscriptionState } from '@/api/subscription';
import type { IconName } from '@/components/ui/Icon';
import { colors } from '@/theme/index';
import { formatDate, formatNumber } from '@/utils/format';

/**
 * What the subscription asks of the teacher right now, in one shape for the home banner and
 * the corner tag (founder 2026-10-25): its tone, icon, title, one line, and the short words for
 * the corner. Null when nothing is asked — paid, exempt — or, for the banner, during the trial
 * (the trial lives in the corner only).
 */
export interface SubscriptionNotice {
  kind: 'trial' | 'pending' | 'late' | 'blocked' | 'lapsed' | 'locked';
  icon: IconName;
  ink: string;
  tint: string;
  title: string;
  line: string;
  corner: string;
}

export function subscriptionNotice(sub: SubscriptionState | null | undefined, t: TFunction): SubscriptionNotice | null {
  if (!sub) return null;
  const n = (v: number | null | undefined) => formatNumber(Number(v ?? 0), { maximumFractionDigits: 0 });
  const amount = `${n(sub.price)} ${t('subscription.egp')}`;
  const day = (d: string | null) => (d ? formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' }) : '—');
  const days = sub.days_left ?? 0;
  switch (sub.phase) {
    case 'late':
      return { kind: 'late', icon: 'warning', ink: colors.danger, tint: colors.dangerLight, title: t('subscription.banner_late_t'),
        line: t('subscription.compact_late', { amount, date: day(sub.block_at) }),
        corner: days > 0 ? t('subscription.corner_late', { n: n(days) }) : t('subscription.corner_late_last') };
    case 'blocked':
      return { kind: 'blocked', icon: 'lock', ink: colors.danger, tint: colors.dangerLight, title: t('subscription.phase_blocked'),
        line: t('subscription.compact_blocked', { amount }), corner: t('subscription.phase_blocked') };
    case 'pending':
      return { kind: 'pending', icon: 'card', ink: colors.warningDark, tint: colors.warningLight, title: t('subscription.banner_pending_t'),
        line: t('subscription.compact_pending', { amount, date: day(sub.late_at) }),
        corner: days > 0 ? t('subscription.corner_pending', { n: n(days) }) : t('subscription.corner_pending_last') };
    case 'lapsed':
      return { kind: 'lapsed', icon: 'clock', ink: colors.primary, tint: colors.primaryLight, title: t('subscription.phase_lapsed'),
        line: t('subscription.banner_lapsed_b', { days: n(sub.prices.grace_days) }), corner: t('subscription.corner_lapsed') };
    case 'trial':
      if (sub.enroll_locked) break;
      return { kind: 'trial', icon: 'star', ink: colors.primary, tint: colors.primaryLight, title: t('subscription.phase_trial'),
        line: '', corner: days > 0 ? t('subscription.trial_corner', { n: n(days) }) : t('subscription.trial_corner_last') };
    default:
      break;
  }
  if (sub.enroll_locked) {
    return { kind: 'locked', icon: 'lock', ink: colors.primary, tint: colors.primaryLight, title: t('subscription.strip_locked'),
      line: t('subscription.strip_locked_sub'), corner: t('subscription.corner_locked') };
  }
  return null;
}

/** Whether the home banner is up — the corner tag steps aside while it is, then takes over. */
export const useSubscriptionBannerStore = create<{ open: boolean }>(() => ({ open: false }));
