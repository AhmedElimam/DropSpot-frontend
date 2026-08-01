import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInvoices, submitPaymentProof } from '@/api/invoices';

export function useInvoices() {
  return useQuery({ queryKey: ['invoices'], queryFn: getInvoices });
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
