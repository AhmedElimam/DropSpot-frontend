import client from './client';
import { extractList, extractAttrs } from './utils';

/**
 * A genuinely-overdue bill (not shielded by an allowance) for a student under one
 * teacher. `blocking` is true when check-in is actually barred right now.
 */
export interface BillingAlert {
  student_id: number;
  student_name?: string | null;
  teacher_name?: string | null;
  amount: number;
  count: number;
  blocking: boolean;
}

function mapAlerts(data: any): BillingAlert[] {
  return extractList(data, 'billing-alert').map((item: any) => extractAttrs(item));
}

/** Student: the logged-in student's own overdue bills. */
export async function getStudentBillingStatus(): Promise<BillingAlert[]> {
  const { data } = await client.get('/students/billing-status');
  return mapAlerts(data);
}

/** Parent: overdue bills across all the parent's children. */
export async function getParentBillingStatus(): Promise<BillingAlert[]> {
  const { data } = await client.get('/parents/billing-status');
  return mapAlerts(data);
}
