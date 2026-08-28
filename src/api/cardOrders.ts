import client from './client';

/** A teacher's informational pay-now method (where to send the card fee). */
export interface CardOrderPaymentMethod {
  type: string;
  label: string;
  number: string;
  name: string | null;
}

/** A student the caller may order a card for that doesn't have one yet. */
export interface CardOrderTarget {
  student_id: number;
  name: string;
  grade: string | null;
  can_order: boolean;
  pending_review: boolean;
  reason: 'NO_TEACHER' | 'PENDING_REVIEW' | null;
  teacher: { id: number; name: string } | null;
  payment_methods: CardOrderPaymentMethod[];
  /** Platform InstaPay the card-production fee is paid to (not the teacher's number). */
  card_instapay?: { number: string; name: string } | null;
  /** Optional platform Vodafone Cash number (null when not configured). */
  card_vodafone?: string | null;
}

/** Students without a card that the logged-in family member can order for. */
export async function getCardOrderTargets(): Promise<CardOrderTarget[]> {
  const { data } = await client.get('/card-order/targets');
  return (data.data ?? data ?? []) as CardOrderTarget[];
}

export interface CreateFamilyCardOrderPayload {
  student_id: number;
  delivery_address: string;
  payment_option: 'cash_on_delivery' | 'pay_now';
  imageUri?: string | null; // pay-now proof screenshot
}

export async function createFamilyCardOrder(
  payload: CreateFamilyCardOrderPayload,
): Promise<{ id: number; status: string }> {
  const form = new FormData();
  form.append('student_id', String(payload.student_id));
  form.append('delivery_address', payload.delivery_address);
  form.append('payment_option', payload.payment_option);
  if (payload.payment_option === 'pay_now' && payload.imageUri) {
    const name = payload.imageUri.split('/').pop() || 'proof.jpg';
    const ext = (name.split('.').pop() || 'jpg').toLowerCase();
    form.append('screenshot', { uri: payload.imageUri, name, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` } as any);
  }
  const { data } = await client.post('/card-order', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return (data.data ?? data) as { id: number; status: string };
}
