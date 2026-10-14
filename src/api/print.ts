import client from './client';

/**
 * «المطبعة» — the print marketplace. The teacher puts a PDF up, every live shop prices it,
 * one tap sends it, and the job is followed to the teacher's hands. All teacher-only and
 * behind the `print_market` flag on the server.
 */

export type PrintSpec = { paper: string; ink: string; sides: number; finish: string; delivery_mode: 'pickup' | 'deliver' };

export type Choice = { key: string; label: string };

export interface PrintOptions {
  papers: Choice[];
  inks: Choice[];
  sides: Choice[];
  finishes: Choice[];
  delivery_modes: Choice[];
  badges: Record<string, string>;
  capabilities: Record<string, string>;
  max_file_mb: number;
  max_copies: number;
  platform_fee_on: boolean;
  platform_fee_piastres: number;
  pay_to: { instapay?: { number: string; name: string } | null; vodafone_cash?: string | null };
  live_shops: number;
}

export interface PrintUpload { upload: string; name: string; pages: number; size: number }

export interface Quote {
  ok: boolean;
  reason?: string;
  price_per_page?: number;
  finish_per_copy?: number;
  delivery_fee?: number;
  subtotal?: number;
  platform_fee?: number;
  platform_fee_piastres?: number;
  total?: number;
  turnaround_hours?: number;
}

export interface BoardShop {
  vendor_id: number;
  name: string;
  city: string | null;
  quality_tier: string;
  quality_label: string;
  ink_tech: string;
  ink_tech_label: string;
  turnaround_hours: number;
  min_copies: number;
  pickup: boolean;
  delivery: boolean;
  delivery_fee: number;
  notes: string | null;
  has_sample: boolean;
  distance_km: number | null;
  rating: number | null;
  ratings: number;
  jobs_done: number;
  on_time_pct: number | null;
  open_jobs: number;
  quote: Quote;
  badges: string[];
}

export interface Board { pages: number; copies: number; spec: PrintSpec; shops: BoardShop[] }

/** A shop as the marketplace shows it BEFORE a job exists — the driver card, not the fare. */
export interface MarketShop extends Omit<BoardShop, 'quote'> {
  /** Mean accept→ready hours over finished jobs when measured, else the shop's promise. */
  speed_hours: number;
  speed_measured: boolean;
  capabilities: string[];
  price_from: { bw: number | null; color: number | null };
}

export interface MenuRate { paper: string; ink: string; sides: number; price_per_page: number }
export interface MenuFinish { kind: string; price_per_copy: number }
export interface ShopReview { rating: number; review: string | null; at: string | null; teacher: string; what: string }

export interface ShopProfile extends MarketShop {
  address: string | null;
  phone: string | null;
  menu: { rates: MenuRate[]; finishes: MenuFinish[] };
  reviews: ShopReview[];
}

/**
 * The shop's own arithmetic, run on the phone so every tap re-prices instantly. The server
 * runs the same sum again at send and locks THAT; this is the preview, never the contract.
 */
export function quoteOnMenu(shop: ShopProfile, pages: number, copies: number, spec: PrintSpec, fee: { on: boolean; piastres: number }): Quote {
  const rate = shop.menu.rates.find((r) => r.paper === spec.paper && r.ink === spec.ink && r.sides === spec.sides);
  if (!rate) return { ok: false, reason: 'unavailable' };
  const finish = spec.finish === 'none' ? { kind: 'none', price_per_copy: 0 } : shop.menu.finishes.find((f) => f.kind === spec.finish);
  if (!finish) return { ok: false, reason: 'unavailable' };
  if (spec.delivery_mode === 'deliver' && !shop.delivery) return { ok: false, reason: 'no_delivery' };
  if (spec.delivery_mode === 'pickup' && !shop.pickup) return { ok: false, reason: 'no_pickup' };
  if (copies < shop.min_copies) return { ok: false, reason: 'min_copies' };
  const delivery_fee = spec.delivery_mode === 'deliver' ? shop.delivery_fee : 0;
  const subtotal = Math.round((pages * copies * rate.price_per_page + copies * finish.price_per_copy + delivery_fee) * 100) / 100;
  const platform_fee = fee.on && fee.piastres > 0 ? Math.round(pages * copies * fee.piastres) / 100 : 0;
  return {
    ok: true,
    price_per_page: rate.price_per_page,
    finish_per_copy: finish.price_per_copy,
    delivery_fee,
    subtotal,
    platform_fee,
    platform_fee_piastres: fee.piastres,
    total: Math.round((subtotal + platform_fee) * 100) / 100,
    turnaround_hours: shop.turnaround_hours,
  };
}

/** The choices THIS shop's menu actually offers, in the order the options list them. */
export function menuChoices(shop: ShopProfile, all: Pick<PrintOptions, 'papers' | 'inks' | 'sides' | 'finishes' | 'delivery_modes'>) {
  const has = (f: (r: MenuRate) => boolean) => shop.menu.rates.some(f);
  return {
    papers: all.papers.filter((c) => has((r) => r.paper === c.key)),
    inks: all.inks.filter((c) => has((r) => r.ink === c.key)),
    sides: all.sides.filter((c) => has((r) => String(r.sides) === c.key)),
    finishes: all.finishes.filter((c) => c.key === 'none' || shop.menu.finishes.some((f) => f.kind === c.key)),
    delivery_modes: all.delivery_modes.filter((c) => (c.key === 'pickup' ? shop.pickup : shop.delivery)),
  };
}

export type PrintStatus = 'sent' | 'accepted' | 'declined' | 'printing' | 'ready' | 'delivered' | 'received' | 'cancelled';

export interface PrintJob {
  id: number;
  title: string;
  file_name: string;
  pages: number;
  copies: number;
  spec: PrintSpec;
  spec_label: string;
  delivery_address: string | null;
  shop: { id: number; name?: string; phone?: string | null; city?: string | null; address?: string | null };
  course: { id: number; name: string } | null;
  price_per_page: number;
  finish_per_copy: number;
  delivery_fee: number;
  subtotal: number;
  platform_fee: number;
  total: number;
  turnaround_hours: number;
  due_at: string | null;
  status: PrintStatus;
  status_label: string;
  status_tone: 'warning' | 'info' | 'success' | 'danger' | 'gray';
  can_cancel: boolean;
  can_receive: boolean;
  is_open: boolean;
  decline_reason: string | null;
  payment_status: 'unpaid' | 'claimed' | 'paid';
  payment_label: string;
  payment_method: string | null;
  rating: number | null;
  review: string | null;
  reorder_of: number | null;
  sent_at: string | null;
  accepted_at: string | null;
  printing_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
}

const unwrap = <T,>(data: any): T => (data?.data ?? data) as T;

export async function getPrintOptions(): Promise<PrintOptions> {
  const { data } = await client.get('/teacher/print/options');
  return unwrap<PrintOptions>(data);
}

/** The PDF goes up once; the board prices the token after that. */
export async function uploadPrintFile(file: { uri: string; name: string }): Promise<PrintUpload> {
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name.toLowerCase().endsWith('.pdf') ? file.name : `${file.name}.pdf`, type: 'application/pdf' } as any);
  const { data } = await client.post('/teacher/print/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
  return unwrap<PrintUpload>(data);
}

/** A partner shop that has not published a print menu yet — named, never orderable. */
export interface ComingShop { vendor_id: number; name: string; city: string | null }

export async function getPrintShops(): Promise<{ shops: MarketShop[]; coming?: ComingShop[] }> {
  const { data } = await client.get('/teacher/print/shops');
  return unwrap(data);
}

export async function getPrintShop(id: string | number): Promise<ShopProfile> {
  const { data } = await client.get(`/teacher/print/shops/${id}`);
  return unwrap<ShopProfile>(data);
}

export async function getPrintBoard(params: { upload: string; copies?: number; course_id?: string | number | null } & PrintSpec): Promise<Board> {
  const { data } = await client.post('/teacher/print/quote', params);
  return unwrap<Board>(data);
}

export async function createPrintJob(payload: { upload: string; vendor_id: number; copies: number; title?: string; course_id?: string | number | null; delivery_address?: string | null } & PrintSpec): Promise<PrintJob> {
  const { data } = await client.post('/teacher/print/jobs', payload);
  return unwrap<PrintJob>(data);
}

export async function getPrintJobs(): Promise<{ open: PrintJob[]; closed: PrintJob[] }> {
  const { data } = await client.get('/teacher/print/jobs');
  return unwrap(data);
}

export async function getPrintJob(id: string | number): Promise<PrintJob> {
  const { data } = await client.get(`/teacher/print/jobs/${id}`);
  return unwrap<PrintJob>(data);
}

export async function cancelPrintJob(id: number, reason?: string): Promise<PrintJob> {
  const { data } = await client.post(`/teacher/print/jobs/${id}/cancel`, { reason });
  return unwrap<PrintJob>(data);
}

export async function receivePrintJob(id: number, rating: number | null, review?: string): Promise<PrintJob> {
  const { data } = await client.post(`/teacher/print/jobs/${id}/received`, { rating, review });
  return unwrap<PrintJob>(data);
}

export async function reorderPrintJob(id: number): Promise<PrintJob> {
  const { data } = await client.post(`/teacher/print/jobs/${id}/reorder`);
  return unwrap<PrintJob>(data);
}

export async function claimPrintPayment(id: number, payload: { method: string; reference?: string; proofUri?: string | null }): Promise<PrintJob> {
  const form = new FormData();
  form.append('method', payload.method);
  if (payload.reference) form.append('reference', payload.reference);
  if (payload.proofUri) {
    const name = payload.proofUri.split('/').pop() || 'proof.jpg';
    const ext = (name.split('.').pop() || 'jpg').toLowerCase();
    form.append('proof', { uri: payload.proofUri, name, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` } as any);
  }
  const { data } = await client.post(`/teacher/print/jobs/${id}/payment`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return unwrap<PrintJob>(data);
}

/** The job's walk, for the tracker: which steps are behind, which is now. */
export const PRINT_FLOW: PrintStatus[] = ['sent', 'accepted', 'printing', 'ready', 'delivered', 'received'];
