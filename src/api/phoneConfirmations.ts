import client from './client';

/**
 * «أرقام تحتاج تأكيد» — the phone-verification resolution list (spec §5).
 *
 * Reachable by the teacher AND any assistant by default: the person who typed the
 * number at the door is usually the assistant, and they are the one who can still ask
 * the family. The server scopes every row to the acting teacher's roster.
 *
 * Only the vouch lives here. The other two resolutions reuse the endpoints that already
 * own their review policy — `requestStudentEdit` (correct the number) and
 * `flagParentNumber` (escalate to the admins) — so there is never a second policy for
 * the same act.
 */

export type PhoneConfirmationScope = 'parent' | 'student';

export interface PhoneConfirmation {
  /** Stable per (scope, subject) — safe as a list key. */
  id: string;
  scope: PhoneConfirmationScope;
  student_id: number;
  student_name: string | null;
  student_code: string | null;
  /** The USER whose number is in question — the parent for a parent row, the student otherwise. */
  subject_id: number;
  subject_name: string | null;
  phone: string | null;
  relationship: string | null;
  /** Why this row is here, already phrased for the teacher. */
  reason: string;
  recorded_at: string | null;
  can_escalate: boolean;
}

export async function getPhoneConfirmations(): Promise<{ items: PhoneConfirmation[]; count: number }> {
  const { data } = await client.get('/teacher/phone-confirmations');
  const payload = data.data ?? data;
  return { items: payload.items ?? [], count: payload.count ?? 0 };
}

/**
 * §5 option 2 — "الرقم صحيح، الأسرة لا تملك هاتفًا يستقبل الرسائل".
 * Permanent for THIS number; correcting the number brings the row back on its own.
 */
export async function acknowledgePhone(
  studentId: number,
  scope: PhoneConfirmationScope,
  subjectId: number,
  note?: string,
): Promise<void> {
  await client.post(`/teacher/phone-confirmations/${studentId}/acknowledge`, {
    scope,
    subject_id: subjectId,
    ...(note ? { note } : {}),
  });
}

export async function revokePhoneAcknowledgement(
  studentId: number,
  scope: PhoneConfirmationScope,
  subjectId: number,
): Promise<void> {
  await client.post(`/teacher/phone-confirmations/${studentId}/revoke`, { scope, subject_id: subjectId });
}
