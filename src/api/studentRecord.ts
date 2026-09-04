import client from './client';

/** Fast door-side recording — name + parent phone → dormant student (activates later). */
export type ParentRelationship = 'father' | 'mother' | 'guardian';

export interface RecordStudentPayload {
  student_name: string;
  parent_phone: string;
  student_phone?: string | null;
  /** Optional — the parent can set/modify these at setup before first login. */
  parent_name?: string;
  relationship?: ParentRelationship;
  /** Booking down-payment (دفعة): explicit amount (null = waive); omit for default. */
  down_payment_amount?: number | null;
  down_payment_paid?: number | null;
  booking_secures?: 'session' | 'booklet' | 'flat';
  course_id: number;
  dedupe_decision?: 'new' | 'link';
  link_student_id?: number;
}

export interface RecordStudentResult {
  student_id: number;
  enrollment_id: number | null;
  parent_user_id?: number;
  is_new_parent?: boolean;
  linked?: boolean;
}

/** A duplicate-parent-phone match — id + name ONLY (never the other teacher's data). */
export interface DedupeMatch {
  id: number;
  name: string;
}

/**
 * QR-style offer (server code EXISTING_STUDENT, HTTP 409): the entered STUDENT phone
 * already belongs to a student. `is_own` = one of THIS teacher's students (safe to
 * show their current group); false = another teacher's student (name/grade/code only,
 * their group is never named). "Enroll here" links the student into the chosen course.
 */
export interface ExistingStudentOffer {
  student_id: number;
  name: string;
  grade: string | null;
  student_code: string | null;
  is_own: boolean;
  current_course_name: string | null;
  target_course_name: string;
  already_in_target: boolean;
}

export async function recordStudent(payload: RecordStudentPayload): Promise<RecordStudentResult> {
  const { data } = await client.post('/teacher/students/record', payload);
  return (data.data ?? data) as RecordStudentResult;
}

/**
 * Files hand-to-teacher card orders for an explicit list of enrollments. NEVER called
 * automatically after recording a student — the teacher presses the button (and
 * confirms) — so fast recording alone never orders a card.
 *
 * `already_ordered` counts students skipped because a card order is already open for
 * them, which includes one filed by ANOTHER teacher sharing the student (one card
 * serves every teacher; the other teacher is never named).
 */
export async function orderCardsForNewlyAdded(
  enrollmentIds: number[],
): Promise<{ created: number; skipped: number; already_ordered?: number }> {
  const { data } = await client.post('/teacher/students/record/order-cards', { enrollment_ids: enrollmentIds });
  return (data.data ?? data) as { created: number; skipped: number; already_ordered?: number };
}
