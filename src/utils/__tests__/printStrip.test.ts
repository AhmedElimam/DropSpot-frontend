import { orderStrip, stripChips, stripSummary, usedByShop } from '../printStrip';
import type { MarketShop, PrintJob } from '@/api/print';

const shop = (vendor_id: number, o: Partial<MarketShop> = {}): MarketShop => ({
  vendor_id, name: `s${vendor_id}`, city: null, quality_tier: 'standard', quality_label: '', ink_tech: '', ink_tech_label: '',
  turnaround_hours: 24, min_copies: 1, pickup: true, delivery: false, delivery_fee: 0, notes: null, has_sample: false,
  distance_km: null, rating: null, ratings: 0, jobs_done: 0, on_time_pct: null, open_jobs: 0, badges: [],
  speed_hours: 24, speed_measured: false, capabilities: [], price_from: { bw: null, color: null }, ...o,
});
const job = (shopId: number, status: PrintJob['status'] = 'received') => ({ id: Math.random(), status, shop: { id: shopId } }) as unknown as PrintJob;

describe('print tab shop strip', () => {
  it('counts only jobs that went through, per shop', () => {
    const m = usedByShop([job(1), job(1), job(2, 'cancelled'), job(3, 'declined'), job(2, 'printing')]);
    expect(m.get(1)).toBe(2);
    expect(m.get(2)).toBe(1);
    expect(m.has(3)).toBe(false);
  });

  it('«مقترحة» puts the shops she used first (most-used first), then the server order', () => {
    const list = [shop(1), shop(2), shop(3), shop(4)];
    const used = new Map([[3, 1], [4, 5]]);
    expect(orderStrip(list, 'recommended', used).map((s) => s.vendor_id)).toEqual([4, 3, 1, 2]);
  });

  it('a paused shop sinks to the end of any order', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const list = [shop(1, { paused_until: future, distance_km: 0.5 }), shop(2, { distance_km: 3 }), shop(3, { distance_km: 1 })];
    expect(orderStrip(list, 'nearest', new Map()).map((s) => s.vendor_id)).toEqual([3, 2, 1]);
  });

  it('sorts by price, a missing value last; «توصيل» keeps only delivering shops', () => {
    const list = [shop(1), shop(2, { price_from: { bw: 0.6, color: null }, delivery: true }), shop(3, { price_from: { bw: null, color: 2 } }), shop(4, { price_from: { bw: 0.4, color: null } })];
    expect(orderStrip(list, 'cheapest', new Map()).map((s) => s.vendor_id)).toEqual([4, 2, 3, 1]);
    expect(orderStrip(list, 'delivery', new Map()).map((s) => s.vendor_id)).toEqual([2]);
  });

  it('shows only the chips the data can honour', () => {
    expect(stripChips([shop(1)])).toEqual([]);
    expect(stripChips([shop(1), shop(2)])).toEqual([]);
    expect(stripChips([shop(1, { distance_km: 2, speed_hours: 6, delivery: true }), shop(2)])).toEqual(['recommended', 'nearest', 'fastest', 'delivery']);
    expect(stripChips([shop(1, { delivery: true }), shop(2, { delivery: true })])).toEqual([]);
  });

  it('sums the head line', () => {
    expect(stripSummary([shop(1, { distance_km: 2.5, delivery: true, open_now: true }), shop(2, { distance_km: 1.2 }), shop(3)]))
      .toEqual({ count: 3, nearestKm: 1.2, delivering: 1, openNow: 1 });
  });
});
