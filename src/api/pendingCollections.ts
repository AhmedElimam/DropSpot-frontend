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

export interface CancelDueResult {
  forgiven: string; // amount written off
  count: number;
  what: string;
}

/**
 * «إلغاء المستحق» — forgive a due WITHOUT collecting it, by student id.
 *
 * The opposite of `reverseStudentPayment`: that undoes money that WAS taken and puts the
 * debt back, this cancels a debt that was never paid. Previously only the web page could
 * do it — the app's waive path (`POST /payments/waive`) requires a `card_code`, so a
 * teacher could forgive a due only with the student's card in hand, which is backwards.
 *
 * Teacher-only, and gated server-side on the `cancel_pending_due` flag: the endpoint
 * itself 404s when it is off, so a bundle that has not restarted since the super-admin
 * withdrew it cannot keep using the button. Pass `chargeId` to forgive ONE booklet/booking.
 */
export async function cancelDueFromRoster(
  studentId: number,
  kind: CollectKind,
  chargeId?: number,
): Promise<CancelDueResult> {
  try {
    const { data } = await client.post('/teacher/pending-collections/cancel-due', {
      student_id: studentId,
      kind,
      ...(chargeId != null ? { charge_id: chargeId } : {}),
    });
    return (data.data ?? data) as CancelDueResult;
  } catch (e) {
    // The server already says exactly WHY it refused, in Arabic the teacher can act on —
    // «لا يوجد مستحق لإلغائه», «إلغاء المستحق متاح للمعلّم فقط», «غير متاح حاليًا». Throwing the
    // raw axios error threw all of that away and left one unhelpful «تعذّر إلغاء المستحق» for
    // every cause, so a refusal the teacher could fix was indistinguishable from a bug.
    const d = (e as any)?.response?.data;
    const msg = typeof d?.message === 'string' ? d.message.trim() : '';
    if (msg) {
      const err = new Error(msg);
      (err as any).code = d?.code;
      (err as any).status = (e as any)?.response?.status;
      throw err;
    }
    throw e;
  }
}
