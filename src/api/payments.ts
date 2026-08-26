import client from './client';
import type { ScanPending } from './teacher';

export type PayKind = 'bill' | 'booklet' | 'booking';

export interface PreviewAllResult {
  success: boolean;
  message?: string;
  code?: string;
  student?: { id?: number; name: string };
  // All three dues in one shape (same as the attendance scan) — feeds PayDuesModal.
  pending?: ScanPending | null;
}

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

/**
 * Combined preview — every due for one card (bill + booklet + booking) in a single
 * read, so one scan collects everything. Materialises the idempotent booklet/booking
 * charges server-side, so all dues appear on the FIRST scan.
 */
export async function previewAllPayments(cardCode: string): Promise<PreviewAllResult> {
  try {
    const { data } = await client.post('/payments/preview-all', { card_code: cardCode });
    return data as PreviewAllResult;
  } catch (e) {
    const d = (e as any)?.response?.data;
    if (d) return { success: false, message: d.message ?? '', code: d.code, student: d.student };
    throw e;
  }
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

export interface WaiveResult {
  success: boolean;
  message?: string;
  code?: string;
  student?: { name: string };
  forgiven?: string; // amount written off
  count?: number;
  what?: string;
}

/**
 * Write-off — forgive a kind's full remaining balance without collecting money.
 * Teacher-only on the server (assistants get 403). Not counted as revenue, no SMS.
 */
export async function waivePayment(kind: PayKind, cardCode: string): Promise<WaiveResult> {
  try {
    const { data } = await client.post('/payments/waive', { card_code: cardCode, kind });
    return data as WaiveResult;
  } catch (e) {
    const d = (e as any)?.response?.data;
    if (d) return { success: false, message: d.message ?? '', code: d.code, student: d.student };
    throw e;
  }
}
