import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInvoices, getStudentInvoices, getStudentPendingDues, getParentPendingDues, submitPaymentProof } from '@/api/invoices';
import { getStudentBillingStatus, getParentBillingStatus } from '@/api/billingStatus';

export function useInvoices() {
  return useQuery({ queryKey: ['invoices'], queryFn: getInvoices });
}

// Student's own invoices. Key is nested under ['invoices'] so the payment-proof
// mutation's invalidateQueries(['invoices']) refreshes it too (partial match).
export function useStudentInvoices() {
  return useQuery({ queryKey: ['invoices', 'me'], queryFn: getStudentInvoices });
}

// Outstanding non-invoice dues (booklet fees + booking down-payments). Keyed under
// ['invoices'] so a payment-proof invalidation refreshes these too (partial match).
export function useStudentPendingDues() {
  return useQuery({ queryKey: ['invoices', 'pending-dues', 'me'], queryFn: getStudentPendingDues });
}

export function useParentPendingDues() {
  return useQuery({ queryKey: ['invoices', 'pending-dues', 'children'], queryFn: getParentPendingDues });
}

export function useStudentBillingStatus() {
  return useQuery({ queryKey: ['invoices', 'billing-status', 'me'], queryFn: getStudentBillingStatus });
}

export function useParentBillingStatus() {
  return useQuery({ queryKey: ['invoices', 'billing-status', 'children'], queryFn: getParentBillingStatus });
}

// TEMP/INTERIM (Paymob blocked): submit an InstaPay / VF Cash screenshot.
export function useSubmitPaymentProof() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, imageUri }: { invoiceId: string; imageUri: string }) =>
      submitPaymentProof(invoiceId, imageUri),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}
