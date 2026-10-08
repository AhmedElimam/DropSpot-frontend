import client from './client';

/** One live bill of a month (amounts are strings with 2 decimals). */
export interface YearBill {
  invoice_id: number;
  number: string;
  line: string | null;
  amount: string;
  paid: string;
  remaining: string;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived' | string;
  due_date: string | null;
  sessions: number;
  threshold: number;
  open_cycle: boolean;
}

export interface YearMonth {
  month: string; // YYYY-MM
  label: string; // «أكتوبر»
  phase: 'before_join' | 'joined' | 'future';
  current: boolean;
  held: number;
  attended: number;
  bills: YearBill[];
  can_add: boolean;
  can_prior: boolean;
}

export interface BillingYear {
  student: { id: number; name: string | null; code: string | null };
  enrollments: { id: number; course: string | null; status: string }[];
  enrollment_id: number;
  can: { edit: boolean; add: boolean; cancel: boolean; prior: boolean };
  year: number;
  join_month: string;
  price: string | null;
  sessions_per_cycle: number;
  months: YearMonth[];
}

/** «السنة» — a student's year in one of this teacher's courses, January to December. */
export async function getBillingYear(studentId: number, opts: { year?: number; enrollmentId?: number }): Promise<BillingYear> {
  const { data } = await client.get(`/teacher/students/${studentId}/billing-year`, {
    params: { ...(opts.year ? { year: opts.year } : {}), ...(opts.enrollmentId ? { enrollment: opts.enrollmentId } : {}) },
  });
  return (data.data ?? data) as BillingYear;
}

/** Bill a joined month that has none: a past month is owed at once; this month joins the open cycle. */
export async function addBillingMonth(enrollmentId: number, body: { month: string; amount: number; sessions?: number | null }): Promise<string> {
  const { data } = await client.post(`/teacher/enrollments/${enrollmentId}/billing-year/add`, {
    month: body.month, amount: body.amount, ...(body.sessions ? { sessions: body.sessions } : {}),
  });
  return data?.message ?? '';
}

/** Cancel a month's bill that has nothing paid on it — the teacher only. */
export async function cancelBillingMonth(enrollmentId: number, invoiceId: number): Promise<string> {
  const { data } = await client.post(`/teacher/enrollments/${enrollmentId}/billing-year/cancel`, { invoice_id: invoiceId });
  return data?.message ?? '';
}
