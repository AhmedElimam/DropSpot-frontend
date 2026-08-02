import client from './client';
import { extractList, extractAttrs } from './utils';

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
  const type = ext === 'png' ? 'image/png' : 'image/jpeg';
  // React Native FormData file shape.
  form.append('screenshot', { uri: imageUri, name, type } as any);

  await client.post(`/invoices/${invoiceId}/payment-proofs`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
