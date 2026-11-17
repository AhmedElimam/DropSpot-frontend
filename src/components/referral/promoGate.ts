/**
 * When the «ادعُ معلّمًا» reminder may come up (founder 2026-11-17): founding teachers only,
 * never an assistant or an impersonation, at most once a week, on app open. Pure, so the
 * decision is tested without a phone.
 */
export const PROMO_EVERY_MS = 7 * 24 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** Per account on this phone: the last time the reminder came up (ms since epoch). */
export const promoKey = (userId: number) => `referral_promo_at:${userId}`;

export function parsePromoStamp(v: string | null | undefined): number | null {
  if (!v) return null;
  const ms = Number(v);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/**
 * Due when it never came up, or a week has passed. A stamp more than a day in the future was
 * written under a wrong clock: it would hold the reminder back for as long, so it counts as none.
 */
export function promoDue(last: number | null, now: number): boolean {
  if (last === null) return true;
  if (last > now + DAY_MS) return true;
  return now - last >= PROMO_EVERY_MS;
}

/** Who sees it at all: a founding teacher's own account (`role` is the app's, so an assistant is 'assistant'). */
export function promoAudience(p: { role: string | null | undefined; founding: boolean | null | undefined; impersonating: boolean }): boolean {
  return p.role === 'teacher' && !!p.founding && !p.impersonating;
}

/**
 * The discount tile's count-up, min → max in a few even steps (whole numbers, both ends kept):
 * stepped by short timeouts, ~1 s in all, then it settles and nothing runs.
 */
export function tickerSteps(min: number, max: number, count = 6): number[] {
  if (!(max > min) || count < 2) return [max];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const v = Math.round(min + ((max - min) * i) / (count - 1));
    if (out[out.length - 1] !== v) out.push(v);
  }
  return out;
}
