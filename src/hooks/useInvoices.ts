import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInvoices, getStudentInvoices, submitPaymentProof } from '@/api/invoices';

export function useInvoices() {
  return useQuery({ queryKey: ['invoices'], queryFn: getInvoices });
}

// Student's own invoices. Key is nested under ['invoices'] so the payment-proof
// mutation's invalidateQueries(['invoices']) refreshes it too (partial match).
export function useStudentInvoices() {
  return useQuery({ queryKey: ['invoices', 'me'], queryFn: getStudentInvoices });
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
