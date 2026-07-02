import { useQuery } from '@tanstack/react-query';
import { getInvoices } from '@/api/invoices';

export function useInvoices() {
  return useQuery({ queryKey: ['invoices'], queryFn: getInvoices });
}
