import { quoteOnMenu, menuChoices, payFirstFor, creditUsed, payDueState, daysForm, type ShopProfile, type PrintOptions, type ShopCredit } from '../print';

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

describe('quoteOnMenu — sizes, bulk discount, rush (same numbers as PrintStudioTest)', () => {
  const studio: ShopProfile = {
    ...shop, min_copies: 1,
    size_factors: { A5: 0.6 },
    volume_tiers: [{ min_pages: 1000, pct: 5 }, { min_pages: 5000, pct: 10 }],
    rush: { hours: 4, pct: 25 },
    menu: { rates: [{ paper: '80', ink: 'bw', sides: 1, price_per_page: 0.5 }], finishes: [{ kind: 'none', price_per_copy: 0 }, { kind: 'spiral', price_per_copy: 20 }] },
  };
  const spec = { paper: '80', ink: 'bw', sides: 1, finish: 'spiral', delivery_mode: 'pickup' as const };
  const off = { on: false, piastres: 3 };

  it('takes 5% off the printing at 1200 printed pages', () => {
    const q = quoteOnMenu(studio, 12, 100, spec, off);
    expect(q.printing).toBe(600);
    expect(q.discount_pct).toBe(5);
    expect(q.discount).toBe(30);
    expect(q.subtotal).toBe(2570);
  });

  it('prices A5 at the factor and adds rush on printing + finishing, on the rush clock', () => {
    const q = quoteOnMenu(studio, 12, 100, { ...spec, size: 'A5', rush: true }, off);
    expect(q.price_per_page).toBe(0.3);
    expect(q.printing).toBe(360);
    expect(q.discount).toBe(18);
    expect(q.rush_fee).toBe(585.5);
    expect(q.turnaround_hours).toBe(4);
  });

  it('refuses a size the shop does not print, and a busy shop', () => {
    expect(quoteOnMenu(studio, 1, 10, { ...spec, size: 'A3' }, off).reason).toBe('no_size');
    expect(quoteOnMenu({ ...studio, paused_until: new Date(Date.now() + 3600_000).toISOString() }, 1, 10, spec, off).reason).toBe('paused');
    expect(quoteOnMenu({ ...studio, rush: null }, 1, 10, { ...spec, rush: true }, off).reason).toBe('no_rush');
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

describe('«سجل الدفع» — on credit or pay-first, on the phone', () => {
  const credit: ShopCredit = { on: true, tier: 'good', tier_label: 'جيد', available: 300, pay_first_reason: null, pay_first_label: null, limit_label: 'الطلب أكبر من المتاح لك آجل' };

  it('goes on credit while the job fits what is left of the line', () => {
    expect(payFirstFor(credit, 120)).toEqual({ payFirst: false, label: null });
    expect(payFirstFor(credit, 300)).toEqual({ payFirst: false, label: null });
  });

  it('goes pay-first, with the limit sentence, when the job is bigger than what is left', () => {
    expect(payFirstFor(credit, 300.5)).toEqual({ payFirst: true, label: 'الطلب أكبر من المتاح لك آجل' });
  });

  it('a reason that does not depend on the amount wins over any total', () => {
    const frozen = { ...credit, tier: 'frozen' as const, pay_first_reason: 'frozen', pay_first_label: 'الآجل موقوف على حسابك — كلّم الدعم' };
    expect(payFirstFor(frozen, 1)).toEqual({ payFirst: true, label: 'الآجل موقوف على حسابك — كلّم الدعم' });
    expect(payFirstFor({ ...credit, pay_first_reason: 'shop', pay_first_label: 'x' }, 0).payFirst).toBe(true);
  });

  it('says nothing when the record is off or the shop sent none', () => {
    expect(payFirstFor({ ...credit, on: false, pay_first_reason: 'weak', pay_first_label: 'x' }, 9999)).toEqual({ payFirst: false, label: null });
    expect(payFirstFor(undefined, 50)).toEqual({ payFirst: false, label: null });
  });

  it('fills the used bar from owed / limit, full with no line and something owed', () => {
    expect(creditUsed({ limit: 1000, owed: 250 })).toBe(0.25);
    expect(creditUsed({ limit: 1000, owed: 1400 })).toBe(1);
    expect(creditUsed({ limit: 0, owed: 0 })).toBe(0);
    expect(creditUsed({ limit: 0, owed: 10 })).toBe(1);
  });

  it('dates a credit job against its pay-by day; pay-first and paid jobs have none', () => {
    const now = Date.parse('2026-10-15T12:00:00Z');
    expect(payDueState({ payment_status: 'unpaid', pay_first: false, pay_due_at: '2026-10-16T12:00:00Z' }, now)).toBe('due');
    expect(payDueState({ payment_status: 'unpaid', pay_first: false, pay_due_at: '2026-10-14T12:00:00Z' }, now)).toBe('late');
    expect(payDueState({ payment_status: 'claimed', pay_first: false, pay_due_at: '2026-10-14T12:00:00Z' }, now)).toBe('none');
    expect(payDueState({ payment_status: 'unpaid', pay_first: true, pay_due_at: null }, now)).toBe('none');
    expect(payDueState({ payment_status: 'unpaid', pay_due_at: null }, now)).toBe('none');
  });

  it('picks the Arabic count form for the grace days', () => {
    expect([0, 1, 2, 3, 10, 11, 30].map(daysForm)).toEqual(['0', '1', '2', 'few', 'few', 'many', 'many']);
  });
});
