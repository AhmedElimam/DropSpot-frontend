import client from './client';

/**
 * Fast door-side recording — name + a phone → dormant student (activates later). The parent's
 * number is optional since 2026-11-03: without it the student is texted a link to add it.
 */
export type ParentRelationship = 'father' | 'mother' | 'guardian';

import type { EnrollmentTermsInput } from './enrollmentTerms';

/** The shared enrolment terms (position, دفعة, booklet) ride along — see src/api/enrollmentTerms.ts. */
export interface RecordStudentPayload extends EnrollmentTermsInput {
  /** Not needed on a link: nothing typed is saved on an existing student. */
  student_name?: string;
  /** Optional when the student's own phone is given (one of the two is required). */
  parent_phone?: string;
  student_phone?: string | null;
  /** Optional — the parent can set/modify these at setup before first login. */
  parent_name?: string;
  relationship?: ParentRelationship;
  course_id: number;
  dedupe_decision?: 'new' | 'link';
  link_student_id?: number;
  /** «تسجيل رغم اختلاف الصف» — the answer to a GRADE_MISMATCH on a link. */
  accept_grade_mismatch?: boolean;
  /** One weekly time of the course; absent = the whole course (fast register v2). */
  session_schedule_id?: number;
  /** «بنفس الاسم؟» answered yes: a second child with this first name on the parent's number. */
  allow_same_name?: boolean;
}

export interface RecordStudentResult {
  student_id: number;
  enrollment_id: number | null;
  parent_user_id?: number;
  is_new_parent?: boolean;
  linked?: boolean;
  /** Recorded without a parent: the student was texted the «ضيف رقم ولي أمرك» link. */
  parent_invited?: boolean;
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
  /** The typed name opens with another first name: the number is a sibling's, not this child's. */
  other_child?: boolean;
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

/** A child on a parent's number, as the fast-register lookup shows it (grade/code/group only for own). */
export interface LookupChild {
  student_id: number;
  name: string;
  is_own: boolean;
  grade: string | null;
  student_code: string | null;
  current_course_name: string | null;
  already_in_target: boolean;
}

/**
 * Fast register v2 (founder 2026-11-06): «do we already know this number?» before the form.
 * `phone` comes back normalised (01XXXXXXXXX).
 */
export type RecordLookup =
  | { outcome: 'student'; phone: string; student: ExistingStudentOffer & { needs_parent: boolean } }
  | { outcome: 'parent'; phone: string; children: LookupChild[] }
  | { outcome: 'unknown'; phone: string }
  | { outcome: 'role_conflict' | 'blocked'; phone: string; message: string };

export async function lookupRecordPhone(courseId: number, phone: string): Promise<RecordLookup> {
  const { data } = await client.post('/teacher/students/record/lookup', { course_id: courseId, phone });
  return (data.data ?? data) as RecordLookup;
}
