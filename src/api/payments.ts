import client from './client';

export type PayKind = 'bill' | 'booklet';

export interface PaymentResult {
  success: boolean;
  message?: string;
  code?: string;
  student?: { id?: number; name: string };
  amount?: string;
  count?: number;
  what?: string;
}

/**
 * In-field collection (teacher app). Two steps: preview what's owed (read-only),
 * then collect after the on-device confirmation. Mirrors the web pay kiosk.
 */
function unwrap(e: any): PaymentResult {
  const d = e?.response?.data;
  if (d) return { success: false, message: d.message ?? '', code: d.code, student: d.student };
  throw e;
}

export async function previewPayment(kind: PayKind, cardCode: string): Promise<PaymentResult> {
  try {
    const { data } = await client.post('/payments/preview', { card_code: cardCode, kind });
    return data as PaymentResult;
  } catch (e) {
    return unwrap(e);
  }
}

export async function collectPayment(kind: PayKind, cardCode: string): Promise<PaymentResult> {
  try {
    const { data } = await client.post('/payments/collect', { card_code: cardCode, kind });
    return data as PaymentResult;
  } catch (e) {
    return unwrap(e);
  }
}
