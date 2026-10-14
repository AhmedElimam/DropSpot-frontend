import { quoteOnMenu, menuChoices, type ShopProfile, type PrintOptions } from '../print';

/**
 * The phone prices the job on the shop's own card so every tap answers instantly; the
 * arithmetic must match the server's PrintMenuService::quote to the piastre, or the locked
 * total at send would surprise the teacher.
 */
const shop: ShopProfile = {
  vendor_id: 7, name: 'ink Town', city: 'المنصورة', quality_tier: 'standard', quality_label: 'عادية', ink_tech: 'laser', ink_tech_label: 'ليزر',
  turnaround_hours: 24, speed_hours: 10, speed_measured: true, min_copies: 5, pickup: true, delivery: true, delivery_fee: 30, notes: null, has_sample: false,
  distance_km: null, rating: 4.7, ratings: 3, jobs_done: 3, on_time_pct: 100, open_jobs: 0, capabilities: ['color', 'duplex', 'staple'],
  price_from: { bw: 0.5, color: 1 }, badges: [], address: null, phone: null, reviews: [],
  menu: {
    rates: [
      { paper: '80', ink: 'bw', sides: 1, price_per_page: 0.5 },
      { paper: '80', ink: 'bw', sides: 2, price_per_page: 0.45 },
      { paper: '80', ink: 'color', sides: 1, price_per_page: 1 },
    ],
    finishes: [{ kind: 'none', price_per_copy: 0 }, { kind: 'staple', price_per_copy: 5 }],
  },
};

const options: Pick<PrintOptions, 'papers' | 'inks' | 'sides' | 'finishes' | 'delivery_modes'> = {
  papers: [{ key: '70', label: '٧٠' }, { key: '80', label: '٨٠' }, { key: 'glossy', label: 'لامع' }],
  inks: [{ key: 'bw', label: 'أبيض وأسود' }, { key: 'color', label: 'ألوان' }],
  sides: [{ key: '1', label: 'وجه' }, { key: '2', label: 'وجهين' }],
  finishes: [{ key: 'none', label: 'بدون' }, { key: 'staple', label: 'دبّوس' }, { key: 'spiral', label: 'سلك' }],
  delivery_modes: [{ key: 'pickup', label: 'استلام' }, { key: 'deliver', label: 'توصيل' }],
};

describe('quoteOnMenu — the shop arithmetic on the phone', () => {
  it('sums pages × copies × rate + copies × finish + delivery, fee off', () => {
    const q = quoteOnMenu(shop, 3, 42, { paper: '80', ink: 'bw', sides: 2, finish: 'staple', delivery_mode: 'pickup' }, { on: false, piastres: 3 });
    expect(q.ok).toBe(true);
    expect(q.subtotal).toBe(3 * 42 * 0.45 + 42 * 5); // 266.7
    expect(q.platform_fee).toBe(0);
    expect(q.total).toBe(266.7);
  });

  it('adds the delivery fee and the per-page platform fee when switched on', () => {
    const q = quoteOnMenu(shop, 10, 5, { paper: '80', ink: 'color', sides: 1, finish: 'none', delivery_mode: 'deliver' }, { on: true, piastres: 3 });
    expect(q.subtotal).toBe(50 + 30);
    expect(q.platform_fee).toBe(1.5); // 50 printed pages × 3 piastres
    expect(q.total).toBe(81.5);
  });

  it('refuses what the shop does not offer, with the reason', () => {
    expect(quoteOnMenu(shop, 1, 10, { paper: '80', ink: 'color', sides: 2, finish: 'none', delivery_mode: 'pickup' }, { on: false, piastres: 0 }).reason).toBe('unavailable');
    expect(quoteOnMenu(shop, 1, 10, { paper: '80', ink: 'bw', sides: 1, finish: 'spiral', delivery_mode: 'pickup' }, { on: false, piastres: 0 }).reason).toBe('unavailable');
    expect(quoteOnMenu(shop, 1, 2, { paper: '80', ink: 'bw', sides: 1, finish: 'none', delivery_mode: 'pickup' }, { on: false, piastres: 0 }).reason).toBe('min_copies');
  });
});

describe('menuChoices — only what this shop offers', () => {
  it('keeps the options order and drops what the card lacks', () => {
    const c = menuChoices(shop, options);
    expect(c.papers.map((x) => x.key)).toEqual(['80']);
    expect(c.inks.map((x) => x.key)).toEqual(['bw', 'color']);
    expect(c.sides.map((x) => x.key)).toEqual(['1', '2']);
    expect(c.finishes.map((x) => x.key)).toEqual(['none', 'staple']);
    expect(c.delivery_modes.map((x) => x.key)).toEqual(['pickup', 'deliver']);
  });
});
