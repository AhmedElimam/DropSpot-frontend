import client from './client';

/**
 * Payment-proof review (teacher, or an assistant granted `review_payment_proofs`).
 * A parent's remote-transfer screenshot; approving marks the invoice paid.
 */
export interface PaymentProofInvoice {
  id: number;
  number: string;
  amount: number;
  student_name: string | null;
}

export interface PaymentProof {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string | null;
  submitted_by_name: string | null;
  reviewed_at: string | null;
  reviewer_name: string | null;
  rejection_reason: string | null;
  invoice: PaymentProofInvoice | null;
  /** Short-lived signed URL for the screenshot (load directly into <Image>). */
  image_url: string;
}

export interface PaymentProofsData {
  pending: PaymentProof[];
  reviewed: PaymentProof[];
}

export async function getPaymentProofs(): Promise<PaymentProofsData> {
  const { data } = await client.get('/teacher/payment-proofs');
  return (data.data ?? { pending: [], reviewed: [] }) as PaymentProofsData;
}

export async function approvePaymentProof(id: number): Promise<void> {
  await client.post(`/teacher/payment-proofs/${id}/approve`);
}

export async function rejectPaymentProof(id: number, reason: string): Promise<void> {
  await client.post(`/teacher/payment-proofs/${id}/reject`, { rejection_reason: reason });
}
