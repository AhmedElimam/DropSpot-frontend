import client from './client';
import type { PaymentMethod } from './invoices';

/** One open invoice a receipt can settle. */
export interface ShareInvoice {
  id: string;
  number: string;
  amount: number;
  remaining: number;
  status: 'pending' | 'overdue';
  due_date: string | null;
  student_id: number;
  student_name: string | null;
  items: string[];
}

/**
 * A teacher the family still owes by transfer (founder 2026-11-11): only these appear in the
 * phone's share sheet, and in the send screen. Overdue first, then the most owed.
 */
export interface ShareTeacher {
  teacher_id: number;
  name: string | null;
  gender: 'male' | 'female';
  logo_url: string | null;
  overdue: boolean;
  total_remaining: number;
  payment_methods: PaymentMethod[];
  invoices: ShareInvoice[];
}

export async function getShareTargets(): Promise<ShareTeacher[]> {
  const { data } = await client.get('/parents/share-targets');
  return (data?.data ?? []) as ShareTeacher[];
}
