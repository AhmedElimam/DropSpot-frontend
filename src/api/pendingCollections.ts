import client from './client';

/**
 * Pending Collections roster (teacher app) — parity with the web /pending-collections
 * page. A status list of every enrolled student who has a bill: remaining owed AND
 * already paid, including fully-settled students. Collection is by student id (a list
 * tap, not a card scan). FINANCE — teacher-only; the API rejects assistants.
 */

export interface RosterBill {
  total: number; // remaining owed
  paid: number; // already collected across the student's invoices
  original: number;
  partial: boolean;
  settled: boolean; // fully paid (nothing left, something was paid)
  count: number;
  overdue: boolean;
}

/**
 * One shape for every non-invoice due — booklets and bookings are now identical
 * (KioskPendingService::due()). `amount` and `remaining` are the same number; prefer
 * `remaining` in new code, it says what it means.
 */
export interface RosterDue {
  id: number;
  course: string | null;
  amount: number; // still owed — alias of `remaining`
  remaining: number; // still owed
  original: number; // the charge's face value
  paid: number; // collected so far
  partial: boolean;
}

export interface RosterStudent {
  student_id: number;
  name: string;
  code: string | null;
  bill: RosterBill | null;
  booklets: RosterDue[];
  bookings: RosterDue[];
}

export interface CollectResult {
  amount: string; // collected now
  remaining: string; // still due after this payment
  count: number;
  what: string;
}

export async function getPendingCollections(): Promise<RosterStudent[]> {
  const { data } = await client.get('/teacher/pending-collections');
  return (data.data?.students ?? data.students ?? []) as RosterStudent[];
}

export type CollectKind = 'bill' | 'booklet' | 'booking';

/** Collect from the roster by student id. Omit `amount` to settle the full remainder. */
export async function collectFromRoster(
  studentId: number,
  kind: CollectKind,
  amount?: number,
): Promise<CollectResult> {
  const { data } = await client.post('/teacher/pending-collections/collect', {
    student_id: studentId,
    kind,
    ...(amount != null ? { amount } : {}),
  });
  return (data.data ?? data) as CollectResult;
}
