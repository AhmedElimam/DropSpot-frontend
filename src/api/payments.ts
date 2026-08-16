import client from './client';

export type PayKind = 'bill' | 'booklet' | 'booking';

export interface PaymentResult {
  success: boolean;
  message?: string;
  code?: string;
  student?: { id?: number; name: string };
  // preview: `amount` = still owed (the remainder), `paid` = already collected.
  // collect: `amount` = collected now, `remaining` = still due after this payment.
  amount?: string;
  paid?: string;
  remaining?: string;
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

export async function collectPayment(kind: PayKind, cardCode: string, amount?: number): Promise<PaymentResult> {
  try {
    // Omit `amount` to collect the full balance; pass it for a partial payment.
    const { data } = await client.post('/payments/collect', {
      card_code: cardCode,
      kind,
      ...(amount != null ? { amount } : {}),
    });
    return data as PaymentResult;
  } catch (e) {
    return unwrap(e);
  }
}
