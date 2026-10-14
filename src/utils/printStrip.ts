import type { MarketShop, PrintJob } from '@/api/print';

/**
 * The print tab's «مطابع بشغلها» strip, as plain arithmetic (founder 2026-10-14: «needs some
 * love»): which shops she already prints at, which quick chips the data can honour, and the
 * order each chip puts the strip in. Kept out of the component so it is testable.
 */
export type StripChip = 'recommended' | 'nearest' | 'cheapest' | 'fastest' | 'delivery';

const paused = (s: MarketShop, now: number) => !!s.paused_until && new Date(s.paused_until).getTime() > now;
const price = (s: MarketShop) => s.price_from.bw ?? s.price_from.color;

/** Jobs per shop (vendor id) that really went through — a cancelled or declined one is not «printed there». */
export function usedByShop(jobs: PrintJob[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const j of jobs) {
    if (j.status === 'cancelled' || j.status === 'declined' || j.shop?.id == null) continue;
    m.set(j.shop.id, (m.get(j.shop.id) ?? 0) + 1);
  }
  return m;
}

/** Only the chips that would change something: «الأقرب» needs a distance, «توصيل» needs some (not all) to deliver. */
export function stripChips(shops: MarketShop[]): StripChip[] {
  if (shops.length < 2) return [];
  const out: StripChip[] = ['recommended'];
  if (shops.some((s) => s.distance_km != null)) out.push('nearest');
  if (shops.filter((s) => price(s) != null).length > 1) out.push('cheapest');
  if (new Set(shops.map((s) => s.speed_hours)).size > 1) out.push('fastest');
  const delivering = shops.filter((s) => s.delivery).length;
  if (delivering > 0 && delivering < shops.length) out.push('delivery');
  return out.length > 1 ? out : [];
}

/**
 * The strip in the chip's order. «مقترحة» = the shops she printed at first (most-used first),
 * then the server's own order; a paused shop always sinks to the end. Sorts are stable and
 * a missing value (no distance, no price) goes last.
 */
export function orderStrip(shops: MarketShop[], chip: StripChip, used: Map<number, number>, now = Date.now()): MarketShop[] {
  const idx = new Map(shops.map((s, i) => [s.vendor_id, i]));
  const by = (f: (s: MarketShop) => number | null | undefined) => (a: MarketShop, b: MarketShop) => {
    const x = f(a); const y = f(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return x - y;
  };
  const recommended = (a: MarketShop, b: MarketShop) => (used.get(b.vendor_id) ?? 0) - (used.get(a.vendor_id) ?? 0);
  const cmp: Record<StripChip, (a: MarketShop, b: MarketShop) => number> = {
    recommended,
    nearest: by((s) => s.distance_km),
    cheapest: by(price),
    fastest: by((s) => s.speed_hours),
    delivery: recommended,
  };
  const pool = chip === 'delivery' ? shops.filter((s) => s.delivery) : shops;
  return [...pool].sort((a, b) => (Number(paused(a, now)) - Number(paused(b, now)))
    || cmp[chip](a, b)
    || (idx.get(a.vendor_id) ?? 0) - (idx.get(b.vendor_id) ?? 0));
}

/** The head's soft line: how many, the nearest one's distance, how many deliver, how many are open. */
export function stripSummary(shops: MarketShop[]) {
  const km = shops.map((s) => s.distance_km).filter((d): d is number => d != null);
  return {
    count: shops.length,
    nearestKm: km.length ? Math.min(...km) : null,
    delivering: shops.filter((s) => s.delivery).length,
    openNow: shops.filter((s) => s.open_now === true).length,
  };
}
