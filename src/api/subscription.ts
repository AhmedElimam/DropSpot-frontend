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
}

export async function getSubscription(): Promise<SubscriptionResponse> {
  const { data } = await client.get('/teacher/subscription');
  return { state: data?.data?.state ?? null, payment: data?.data?.payment ?? {} };
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
