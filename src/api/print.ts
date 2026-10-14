import client from './client';
import { STAGING_KEY, STAGING_HEADER } from '@/config/env';

/**
 * «المطبعة» — the print marketplace. The teacher puts a PDF up, every live shop prices it,
 * one tap sends it, and the job is followed to the teacher's hands. All teacher-only and
 * behind the `print_market` flag on the server.
 */

export type PrintSpec = { paper: string; ink: string; sides: number; finish: string; delivery_mode: 'pickup' | 'deliver'; size?: string; rush?: boolean; extras?: number[] };

/** Something a shop charges for in its own words, per page / copy / job. */
export interface ShopExtra { id: number; name: string; unit: 'page' | 'copy' | 'job'; unit_label: string; price: number }
export interface Destination { id: number; name: string; address: string | null; lat: number; lng: number }

export type Choice = { key: string; label: string };

export interface PrintOptions {
  papers: Choice[];
  inks: Choice[];
  sides: Choice[];
  finishes: Choice[];
  delivery_modes: Choice[];
  sizes?: Choice[];
  extra_units?: Record<string, string>;
  /** Google Maps key from the server's config (null = the OpenStreetMap fallback). */
  maps_key?: string | null;
  /** The teacher's located venues — where a driver can ride to. */
  destinations?: Destination[];
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
  printing?: number;
  discount?: number;
  discount_pct?: number;
  rush_fee?: number;
  extras?: (ShopExtra & { amount: number })[];
  extras_total?: number;
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
  /** The shop's logo (signed link, stable for a week), or null. */
  logo?: string | null;
  tagline?: string | null;
  cover?: ShopSample | null;
  samples_count?: number;
  /** «مشغول حتى …» — on the marketplace, but no job can be sent. */
  paused_until?: string | null;
  open_now?: boolean | null;
  hours_label?: string | null;
  sizes?: string[];
  size_factors?: Record<string, number>;
  rush?: { hours: number; pct: number } | null;
  volume_tiers?: { min_pages: number; pct: number }[];
  extras?: ShopExtra[];
  drivers?: number;
  lat?: number | null;
  lng?: number | null;
  /** The branch the distance and the pin are from (nearest to the teacher). */
  branch?: { id: number; name: string; address: string | null } | null;
  branches_count?: number;
}

/** A photo of the shop's own work (signed link, stable for a week). */
/** A shop's branch (founder 2026-10-14: shops have branches); distance from the teacher when known. */
export interface ShopBranch { id: number; name: string; address: string | null; phone: string | null; hours_note: string | null; is_main: boolean; lat: number | null; lng: number | null; distance_km: number | null }

export interface ShopSample { id: number; url: string; caption: string | null; kind: string | null; kind_label: string | null; width: number | null; height: number | null }

/** expo-image source for a shop photo — the staging build also needs its door key. */
export const sampleSource = (url: string) => (STAGING_KEY ? { uri: url, headers: { [STAGING_HEADER]: STAGING_KEY } } : { uri: url });

export interface MenuRate { paper: string; ink: string; sides: number; price_per_page: number }
export interface MenuFinish { kind: string; price_per_copy: number }
export interface ShopReview { rating: number; review: string | null; at: string | null; teacher: string; what: string }

export interface ShopProfile extends MarketShop {
  address: string | null;
  phone: string | null;
  menu: { rates: MenuRate[]; finishes: MenuFinish[] };
  reviews: ShopReview[];
  samples?: ShopSample[];
  /** Every open branch, nearest first. */
  branches?: ShopBranch[];
}

/**
 * The shop's own arithmetic, run on the phone so every tap re-prices instantly. The server
 * runs the same sum again at send and locks THAT; this is the preview, never the contract.
 */
export function quoteOnMenu(shop: ShopProfile, pages: number, copies: number, spec: PrintSpec, fee: { on: boolean; piastres: number }): Quote {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  if (shop.paused_until && new Date(shop.paused_until).getTime() > Date.now()) return { ok: false, reason: 'paused' };
  const size = spec.size ?? 'A4';
  const factor = size === 'A4' ? 1 : Number(shop.size_factors?.[size] ?? 0);
  if (!factor) return { ok: false, reason: 'no_size' };
  if (spec.rush && !shop.rush) return { ok: false, reason: 'no_rush' };
  const rate = shop.menu.rates.find((r) => r.paper === spec.paper && r.ink === spec.ink && r.sides === spec.sides);
  if (!rate) return { ok: false, reason: 'unavailable' };
  const finish = spec.finish === 'none' ? { kind: 'none', price_per_copy: 0 } : shop.menu.finishes.find((f) => f.kind === spec.finish);
  if (!finish) return { ok: false, reason: 'unavailable' };
  if (spec.delivery_mode === 'deliver' && !shop.delivery) return { ok: false, reason: 'no_delivery' };
  if (spec.delivery_mode === 'pickup' && !shop.pickup) return { ok: false, reason: 'no_pickup' };
  if (copies < shop.min_copies) return { ok: false, reason: 'min_copies' };

  const printed = pages * copies;
  const chosen: (ShopExtra & { amount: number })[] = [];
  for (const id of spec.extras ?? []) {
    const x = (shop.extras ?? []).find((e) => e.id === id);
    if (!x) return { ok: false, reason: 'unavailable' };
    chosen.push({ ...x, amount: r2(x.unit === 'page' ? printed * x.price : x.unit === 'copy' ? copies * x.price : x.price) });
  }
  const extras_total = r2(chosen.reduce((a, x) => a + x.amount, 0));
  const price_per_page = r2(rate.price_per_page * factor);
  const printing = r2(printed * price_per_page);
  const discount_pct = (shop.volume_tiers ?? []).reduce((p, t) => (printed >= t.min_pages ? Math.max(p, t.pct) : p), 0);
  const discount = r2((printing * discount_pct) / 100);
  const finishing = r2(copies * finish.price_per_copy);
  const rush_fee = spec.rush && shop.rush ? r2(((printing - discount + finishing + extras_total) * shop.rush.pct) / 100) : 0;
  const delivery_fee = spec.delivery_mode === 'deliver' ? shop.delivery_fee : 0;
  const subtotal = r2(printing - discount + finishing + extras_total + rush_fee + delivery_fee);
  const platform_fee = fee.on && fee.piastres > 0 ? Math.round(printed * fee.piastres) / 100 : 0;
  return {
    ok: true,
    price_per_page,
    finish_per_copy: finish.price_per_copy,
    printing,
    discount,
    discount_pct,
    rush_fee,
    extras: chosen,
    extras_total,
    delivery_fee,
    subtotal,
    platform_fee,
    platform_fee_piastres: fee.piastres,
    total: r2(subtotal + platform_fee),
    turnaround_hours: spec.rush && shop.rush ? shop.rush.hours : shop.turnaround_hours,
  };
}

/** The choices THIS shop's menu actually offers, in the order the options list them. */
export function menuChoices(shop: ShopProfile, all: Pick<PrintOptions, 'papers' | 'inks' | 'sides' | 'finishes' | 'delivery_modes' | 'sizes'>) {
  const has = (f: (r: MenuRate) => boolean) => shop.menu.rates.some(f);
  return {
    sizes: (all.sizes ?? [{ key: 'A4', label: 'A4' }]).filter((c) => c.key === 'A4' || Number(shop.size_factors?.[c.key] ?? 0) > 0),
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
  shop: { id: number; name?: string; logo?: string | null; phone?: string | null; city?: string | null; address?: string | null };
  /** The branch that prints it. */
  branch?: { id: number; name: string; address: string | null; phone: string | null; lat: number | null; lng: number | null } | null;
  course: { id: number; name: string } | null;
  price_per_page: number;
  finish_per_copy: number;
  delivery_fee: number;
  discount?: number;
  rush_fee?: number;
  extras?: (ShopExtra & { amount: number })[];
  extras_total?: number;
  dest?: { lat: number; lng: number; name: string | null } | null;
  /** The trip, when a driver carries the job. */
  delivery?: { status: string; label: string; is_active: boolean; driver: string | null; eta_min: number | null } | null;
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
/**
 * A file name as the teacher sees it: decoded if the picker handed it encoded, the invisible
 * bidi marks dropped, composed to NFC (iOS gives «إ» as alef + a combining hamza).
 */
export function cleanFileName(raw: string): string {
  let name = raw || '';
  if (/%[0-9A-Fa-f]{2}/.test(name)) {
    try { name = decodeURIComponent(name); } catch { /* not really encoded */ }
  }
  name = name.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
  name = name.replace(/[\u0000-\u001F\u007F\\/:*?"<>|]+/g, ' ');
  try { name = name.normalize('NFC'); } catch { /* older engines */ }
  name = name.replace(/\s+/g, ' ').trim() || 'ملف';
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}

export async function uploadPrintFile(file: { uri: string; name: string }): Promise<PrintUpload> {
  const form = new FormData();
  const name = cleanFileName(file.name);
  // The multipart filename header mangles Arabic on some phones: an ASCII name there, the real
  // one in its own field, percent-encoded. The server decodes and composes it again.
  form.append('file', { uri: file.uri, name: 'file.pdf', type: 'application/pdf' } as any);
  form.append('name', encodeURIComponent(name));
  const { data } = await client.post('/teacher/print/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
  return unwrap<PrintUpload>(data);
}

/** A partner shop that has not published a print menu yet — named, never orderable. */
export interface ComingShop { vendor_id: number; name: string; city: string | null; logo?: string | null }

export async function getPrintShops(): Promise<{ shops: MarketShop[]; coming?: ComingShop[] }> {
  const { data } = await client.get('/teacher/print/shops');
  return unwrap(data);
}

/** A place found by name for the shops map (a street, a school, a square). */
export interface FoundPlace { name: string; sub: string | null; lat: number; lng: number }

export async function searchPlaces(q: string, near?: { lat: number; lng: number } | null): Promise<FoundPlace[]> {
  const { data } = await client.get('/teacher/print/places', { params: { q, lat: near?.lat, lng: near?.lng } });
  return unwrap<{ places: FoundPlace[] }>(data).places ?? [];
}

export async function getPrintShop(id: string | number): Promise<ShopProfile> {
  const { data } = await client.get(`/teacher/print/shops/${id}`);
  return unwrap<ShopProfile>(data);
}

export async function getPrintBoard(params: { upload: string; copies?: number; course_id?: string | number | null } & PrintSpec): Promise<Board> {
  const { data } = await client.post('/teacher/print/quote', params);
  return unwrap<Board>(data);
}

export async function createPrintJob(payload: { upload: string; vendor_id: number; copies: number; title?: string; course_id?: string | number | null; delivery_address?: string | null; dest_lat?: number | null; dest_lng?: number | null; dest_name?: string | null; branch_id?: number | null } & PrintSpec): Promise<PrintJob> {
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

/** Where the job is, live: the driver's dot and ETA, the trail, the hand-over code. */
/** Where the receiving side shared it is: a fixed pin, or live until a time. */
export interface TeacherShare { lat: number; lng: number; seen_at: string; kind: 'live' | 'static'; until: string | null; by: string | null; by_assistant: boolean }

export interface TrackInfo {
  maps_key?: string | null;
  teacher_live?: TeacherShare | null;
  mode: 'pickup' | 'deliver';
  handover_code: string | null;
  shop: { name: string | null; logo?: string | null; address: string | null; lat: number | null; lng: number | null; branch?: string | null };
  dest: { lat: number; lng: number; name: string | null; address: string | null } | null;
  delivery: {
    status: 'assigned' | 'picked_up' | 'en_route' | 'arrived' | 'delivered' | 'failed';
    label: string;
    tone: 'info' | 'warning' | 'success' | 'danger' | 'gray';
    is_active: boolean;
    driver: { id: number; name: string; phone: string; vehicle: string; vehicle_label: string; lat: number | null; lng: number | null; seen_at: string | null; online: boolean } | null;
    remaining_km: number | null;
    eta_min: number | null;
    distance_km: number | null;
    trail: [number, number][];
    assigned_at: string | null; picked_up_at: string | null; en_route_at: string | null; arrived_at: string | null; delivered_at: string | null;
    fail_reason: string | null;
  } | null;
}

export async function trackPrintJob(id: string | number): Promise<TrackInfo> {
  const { data } = await client.get(`/teacher/print/jobs/${id}/track`);
  return unwrap<TrackInfo>(data);
}

/**
 * The receiving end (teacher, or an assistant with «receive_prints»): orders on their way
 * without the money, the trip, and sharing where you are with the driver.
 */
export async function getReceiveJobs(): Promise<PrintJob[]> {
  const { data } = await client.get('/teacher/print-receive');
  return unwrap<{ jobs: PrintJob[] }>(data).jobs;
}

export async function getReceiveJob(id: string | number): Promise<PrintJob> {
  const { data } = await client.get(`/teacher/print-receive/${id}`);
  return unwrap<PrintJob>(data);
}

export async function trackReceive(id: string | number): Promise<TrackInfo> {
  const { data } = await client.get(`/teacher/print-receive/${id}/track`);
  return unwrap<TrackInfo>(data);
}

/** A fixed pin («static») or a live point («live»; `minutes` 15 / 60 / 480 starts it). */
export async function sharePrintLocation(id: string | number, lat: number, lng: number, mode: 'live' | 'static', minutes?: number): Promise<{ sharing: boolean; share: TeacherShare | null }> {
  const { data } = await client.post(`/teacher/print-receive/${id}/locate`, minutes ? { lat, lng, mode, minutes } : { lat, lng, mode });
  return unwrap(data);
}

export async function stopPrintLocation(id: string | number): Promise<void> {
  await client.delete(`/teacher/print-receive/${id}/locate`);
}

/** The teacher's phone during a trip — the driver rides to the person. */
export async function locatePrintJob(id: string | number, lat: number, lng: number): Promise<{ sharing: boolean }> {
  const { data } = await client.post(`/teacher/print/jobs/${id}/locate`, { lat, lng });
  return unwrap(data);
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
