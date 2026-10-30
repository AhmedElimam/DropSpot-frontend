import client from './client';
import { homePart } from '@/api/homeBatch';

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
  /** The student's live groups (course · weekday time) — «which schedule master is that». */
  groups?: { course_id: number; course_name: string | null; schedule_id: number | null; label: string }[];
  /** Both numbers on every row, each with whether it still needs confirming. */
  student_phone?: string | null;
  student_phone_confirmed?: boolean;
  parent_id?: number | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  parent_relationship?: string | null;
  parent_phone_confirmed?: boolean;
  /** The SMS provider refused this number the last time (invalid / not in service). */
  student_phone_refused?: boolean;
  parent_phone_refused?: boolean;
}

export async function getPhoneConfirmations(): Promise<{ items: PhoneConfirmation[]; count: number }> {
  const data = await homePart('phone_confirmations', () => client.get('/teacher/phone-confirmations').then((r) => r.data));
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

/**
 * Door-side confirmation. The family is at the desk when the number is typed, so this is
 * the one moment it can actually be PROVED rather than vouched for: send the code, ask for
 * the six digits, confirm. Each send costs an SMS, so the UI keeps a cooldown on it.
 */
export async function sendPhoneConfirmationCode(
  studentId: number,
  scope: PhoneConfirmationScope,
  subjectId: number,
): Promise<void> {
  await client.post(`/teacher/phone-confirmations/${studentId}/send-code`, { scope, subject_id: subjectId });
}

/** Type back the digits the family just received. A correct code stamps OTP-verified. */
export async function confirmPhoneCode(
  studentId: number,
  scope: PhoneConfirmationScope,
  subjectId: number,
  code: string,
): Promise<void> {
  await client.post(`/teacher/phone-confirmations/${studentId}/confirm-code`, {
    scope, subject_id: subjectId, code,
  });
}

export async function revokePhoneAcknowledgement(
  studentId: number,
  scope: PhoneConfirmationScope,
  subjectId: number,
): Promise<void> {
  await client.post(`/teacher/phone-confirmations/${studentId}/revoke`, { scope, subject_id: subjectId });
}
