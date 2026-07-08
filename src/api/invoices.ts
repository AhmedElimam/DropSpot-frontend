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

export async function getInvoices(): Promise<Invoice[]> {
  const { data } = await client.get('/parents/invoices');
  return extractList(data, 'invoices').map((item: any) => {
    const attrs = extractAttrs(item);
    return { id: item.id, ...attrs };
  });
}
