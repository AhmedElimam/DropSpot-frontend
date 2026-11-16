import client from './client';

/** The teacher's subscription state as the server computes it (SubscriptionAccess::publicShape). */
export type SubscriptionPhase = 'exempt' | 'blocked' | 'late' | 'pending' | 'active' | 'trial' | 'lapsed';

export interface SubscriptionPrices {
  term: number;
  year: number;
  late_term: number;
  late_year: number;
  trial_days: number;
  grace_days: number;
  block_days: number;
}

/** One plan's first bill: the list price and what the teacher will actually be billed. */
export interface UpcomingPlanPrice {
  list: number;
  price: number;
}

/** The first bill on its way (phases `trial` and `lapsed` only): when it is issued and what it costs. */
export interface SubscriptionUpcoming {
  due_at: string;
  discount_pct?: number | null;
  term: UpcomingPlanPrice;
  year: UpcomingPlanPrice;
}

/** A discount taken off the open bill — today only `referral_welcome` (an invited teacher's first bill). */
export interface SubscriptionDiscount {
  kind: string;
  label?: string | null;
  pct?: number | null;
  amount?: number | null;
}

export interface SubscriptionState {
  phase: SubscriptionPhase;
  blocked: boolean;
  usable: boolean;
  plan: 'term' | 'annual' | null;
  price: number | null;
  standard_price: number | null;
  late_price: number | null;
  prices: SubscriptionPrices;
  due_at: string | null;
  late_at: string | null;
  block_at: string | null;
  expires_at: string | null;
  trial_ends_at: string | null;
  exempt_until: string | null;
  exempt_reason: string | null;
  days_left: number | null;
  subscription_id: number | null;
  /** The soft lock: adding students is frozen until the subscription is paid; the rest of the app is open. */
  enroll_locked?: boolean;
  /** The paid cycle's receipt: when it was paid and when it started (phase `active`). */
  paid_at?: string | null;
  started_at?: string | null;
  /** Set when the viewer is an assistant: the state shown is their teacher's. */
  for_assistant?: boolean;
  /**
   * The welcome discount (founder 2026-11-17). Pending: the % taken off this bill (`price` is then
   * the discounted price, `standard_price` the list price). Trial / lapsed: the % waiting for the
   * first bill. Newer servers only.
   */
  discount_pct?: number | null;
  /** The first bill on its way — trial and lapsed only. Newer servers only. */
  upcoming?: SubscriptionUpcoming | null;
}

export interface PaymentChannels {
  instapay_number: string | null;
  instapay_name: string | null;
  vodafone_number: string | null;
  support_phone: string | null;
}

export interface SubscriptionResponse {
  state: SubscriptionState | null;
  payment: PaymentChannels;
  /** The discounts on the open bill (`data.subscription.discounts`). */
  discounts: SubscriptionDiscount[];
}

export async function getSubscription(): Promise<SubscriptionResponse> {
  const { data } = await client.get('/teacher/subscription');
  const discounts = data?.data?.subscription?.discounts ?? data?.data?.state?.discounts;
  return { state: data?.data?.state ?? null, payment: data?.data?.payment ?? {}, discounts: Array.isArray(discounts) ? discounts : [] };
}

export async function chooseSubscriptionPlan(plan: 'term' | 'annual'): Promise<SubscriptionState> {
  const { data } = await client.post('/teacher/subscription/plan', { plan });
  return data?.data?.state;
}

export async function sendPaidNotice(payload: { method?: string; note?: string }): Promise<string> {
  const { data } = await client.post('/teacher/subscription/paid-notice', payload);
  return data?.data?.message ?? '';
}

/** An exemption the admin gave «for life» is stored as a far date; the screens say «مدى الحياة». */
export function isLifetimeExemption(state: Pick<SubscriptionState, 'phase' | 'exempt_until'>): boolean {
  return state.phase === 'exempt' && (!state.exempt_until || Number(state.exempt_until.slice(0, 4)) >= 2090);
}
