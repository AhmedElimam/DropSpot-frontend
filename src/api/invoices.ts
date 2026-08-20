import client from './client';
import { extractList, extractAttrs } from './utils';

/** Informational payment target the teacher configured (where to send money). */
export interface PaymentMethod {
  type: 'vodafone_cash' | 'instapay';
  /** Display label for the service, e.g. "فودافون كاش" / "إنستا باي". */
  label: string;
  /** The wallet number or InstaPay address to transfer to. */
  number: string;
  /** Expected name on the receiving account (services show it to the sender). */
  name?: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  due_date: string;
  status: 'paid' | 'pending' | 'overdue';
  items: string[];
  student_name?: string;
  teacher_name?: string;
  teacher_phone?: string | null;
  /** Configured digital methods WITH a filled number (where to send money). */
  payment_methods?: PaymentMethod[];
  /** Whether the teacher accepts a remote transfer at all (Vodafone/InstaPay on),
   *  independent of whether a number is filled — drives the upload-proof option. */
  accepts_digital?: boolean;
  /** Whether "pay in person / cash" is offered (default true). */
  accepts_physical?: boolean;
}

/**
 * A non-invoice due a family owes — a booklet (ملزمة) fee or a booking down-payment
 * (دفعة). These are separate from invoices and are collected in person or by
 * transfer; the app shows them so a family knows what's outstanding.
 */
export interface PendingDue {
  id: string;
  kind: 'booking' | 'booklet';
  /** Short Arabic label, e.g. "دفعة حجز" / "ملزمة". */
  title: string;
  course_name?: string | null;
  /** Whose due it is — set so a parent can tell children apart. */
  student_name?: string | null;
  teacher_name?: string | null;
  /** What's still owed (a part-paid دفعة shows only its remainder). */
  amount: number;
  paid: number;
  total: number;
  status: 'unpaid' | 'partial';
  payment_methods?: PaymentMethod[];
  /** Teacher accepts a transfer (Vodafone/InstaPay on), independent of number. */
  accepts_digital?: boolean;
  accepts_physical?: boolean;
}

function mapPendingDues(data: any): PendingDue[] {
  return extractList(data, 'pending-dues').map((item: any) => {
    const attrs = extractAttrs(item);
    return { id: item.id, ...attrs };
  });
}

/** Student: the logged-in student's own outstanding booklet/booking dues. */
export async function getStudentPendingDues(): Promise<PendingDue[]> {
  const { data } = await client.get('/students/pending-dues');
  return mapPendingDues(data);
}

/** Parent: outstanding booklet/booking dues across all the parent's children. */
export async function getParentPendingDues(): Promise<PendingDue[]> {
  const { data } = await client.get('/parents/pending-dues');
  return mapPendingDues(data);
}

function mapInvoices(data: any): Invoice[] {
  return extractList(data, 'invoices').map((item: any) => {
    const attrs = extractAttrs(item);
    return { id: item.id, ...attrs };
  });
}

/** Parent: invoices across all of the parent's children. */
export async function getInvoices(): Promise<Invoice[]> {
  const { data } = await client.get('/parents/invoices');
  return mapInvoices(data);
}

/** Student: the logged-in student's own invoices (self-scoped from the token). */
export async function getStudentInvoices(): Promise<Invoice[]> {
  const { data } = await client.get('/students/invoices');
  return mapInvoices(data);
}

/**
 * TEMP/INTERIM (Paymob blocked): submit an InstaPay / Vodafone Cash transfer
 * screenshot against an outstanding invoice. Creates a pending proof for the
 * teacher to review — does NOT mark the invoice paid. `imageUri` is a local
 * file URI from expo-image-picker.
 */
export async function submitPaymentProof(invoiceId: string, imageUri: string): Promise<void> {
  const form = new FormData();
  const name = imageUri.split('/').pop() || 'proof.jpg';
  const ext = (name.split('.').pop() || 'jpg').toLowerCase();
  // Send the true MIME so the server sees the real format (iPhone gallery hands
  // over HEIC/HEIF, not JPEG — mislabeling it broke the upload).
  const MIME: Record<string, string> = {
    png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
  };
  const type = MIME[ext] ?? 'image/jpeg';
  // React Native FormData file shape.
  form.append('screenshot', { uri: imageUri, name, type } as any);

  await client.post(`/invoices/${invoiceId}/payment-proofs`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
