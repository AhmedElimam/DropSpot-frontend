import client from './client';
import type { Enrollment } from '@/types/enrollment';

export async function getStudentEnrollments(studentId: number): Promise<Enrollment[]> {
  const { data } = await client.get(`/students/${studentId}/enrollments`);
  const items = data.data ?? data.enrollments ?? data;
  return Array.isArray(items) ? items.map(extract) : [];
}

// Soft-terminate (drop) an enrollment — mobile parity for the web action. History
// and past billing are untouched; only future delivery/roster/capacity stop counting.
export async function terminateEnrollment(enrollmentId: number): Promise<void> {
  await client.post(`/teacher/enrollments/${enrollmentId}/terminate`);
}

// Move one student to another of the teacher's OWN courses (drops this enrollment,
// creates a fresh one under the destination). A cross-grade move throws a 422 with
// code 'GRADE_MISMATCH' first; re-call with acceptGradeMismatch=true to confirm it.
export async function transferEnrollment(
  enrollmentId: number,
  toCourseId: number,
  acceptGradeMismatch = false,
): Promise<void> {
  await client.post(`/teacher/enrollments/${enrollmentId}/transfer`, {
    to_course_id: toCourseId,
    accept_grade_mismatch: acceptGradeMismatch,
  });
}

/**
 * The paper register: mark the student PRESENT on the given past sessions of this course
 * (last 90 days). The server also moves the cycle's start back to the earliest known day
 * and re-prices an unpaid invoice. Teacher or an assistant with mark_attendance_manual.
 */
export async function backfillAttendance(
  enrollmentId: number,
  sessionInstanceIds: (number | string)[],
): Promise<{ created: number; skipped: number; started_at: number | null; moved: boolean; repriced: boolean; kept_paid: boolean; invoice_amount: string | null }> {
  const { data } = await client.post(`/teacher/enrollments/${enrollmentId}/backfill-attendance`, {
    session_instance_ids: sessionInstanceIds,
  });
  return data.data ?? data;
}

/**
 * «الطالب على الحصة N» — set where this enrolment stands in its billing cycle (1-based).
 * The server re-prices an unpaid cycle invoice to match; paid ones are never touched.
 * Teacher, or an assistant with manage_students.
 */
export async function setCyclePosition(
  enrollmentId: number,
  joinsAtSession: number,
): Promise<{ position: number; threshold: number; repriced: boolean; kept_paid: boolean; invoice_amount: string | null }> {
  const { data } = await client.post(`/teacher/enrollments/${enrollmentId}/cycle-position`, {
    joins_at_session: joinsAtSession,
  });
  return data.data ?? data;
}

/**
 * Restate what this cycle costs. Use when the POSITION is already right but the figure is
 * not — a part-session, a discount, a number agreed with the family. Teacher only; the
 * previous invoice is cancelled beside the new one rather than edited.
 */
/** How the bill is corrected (2026-10-06): an amount off it, fewer sessions, or the amount itself. */
export type CorrectionMode = 'discount' | 'sessions' | 'total';

export async function setCycleAmount(
  enrollmentId: number,
  correction: { mode: CorrectionMode; amount?: number; discount?: number; sessions?: number | null; invoiceId?: number | null },
): Promise<{ invoice: { id: number; amount: number; paid_amount: number; status: string } | null }> {
  const { mode, amount, discount, sessions, invoiceId } = correction;
  const { data } = await client.post(`/teacher/enrollments/${enrollmentId}/cycle-amount`, {
    mode,
    ...(mode === 'total' && amount !== undefined ? { amount } : {}),
    ...(mode === 'discount' && discount !== undefined ? { discount } : {}),
    // For «fewer sessions» it IS the correction; for a stated amount it is the label on the line.
    ...(sessions ? { sessions } : {}),
    // Which bill — an older month's included; absent = the open cycle's.
    ...(invoiceId ? { invoice_id: invoiceId } : {}),
  });
  return data.data ?? data;
}

/**
 * «سُدِّدت قبل الانضمام» — this cycle's bill was paid before the teacher was on the system.
 * The server marks it settled (whole, or `amount` of it) as prior money: no drawer, no
 * «collected», the next cycle bills normally. Teacher, or an assistant with manage_students
 * (an assistant's word lands in the teacher's review bucket).
 */
export async function settleCycleBeforeJoining(
  enrollmentId: number,
  amount?: number | null,
): Promise<{ applied: number; invoice: { id: number; amount: number; paid_amount: number; prior_paid_amount: number; remaining: number; status: string } | null }> {
  const { data } = await client.post(`/teacher/enrollments/${enrollmentId}/settled-before-joining`, amount ? { amount } : {});
  return data.data ?? data;
}

function extract(item: any): Enrollment {
  const a = item.attributes ?? item;
  return {
    id: parseInt(item.id, 10),
    student_id: a.student_id,
    course_id: a.course_id,
    teacher_id: a.teacher_id,
    academic_session_id: a.academic_session_id,
    status: a.status,
    enrolled_at: a.enrolled_at,
    course: a.course,
    teacher: a.teacher,
  };
}
