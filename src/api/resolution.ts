import client from './client';
import { homePart } from '@/api/homeBatch';
import { extractList, extractAttrs } from './utils';

/**
 * Resolution Center — the teacher's consolidated review queues (previously web-only):
 * absence excuses + session-swap requests, plus a needs-attention summary. Mirrors
 * the web pending-actions flows.
 */

export interface ResolutionSummary {
  excuses: number;
  swaps: number;
  tickets: number;
  termination_candidates: number;
  /** Assistant-filed incident reports / parent-number flags awaiting the teacher's review. */
  assistant_reports?: number;
  /** «أرقام تحتاج تأكيد» — unverified parent/student numbers on this roster (spec §5). */
  phone_confirmations?: number;
  total: number;
}

/**
 * An assistant's incident report ('report') or parent-number flag ('flag') waiting for the
 * TEACHER before it reaches the admins. Approve forwards it as the teacher's own; reject
 * closes it and tells the assistant.
 */
export interface AssistantReportItem {
  kind: 'report' | 'flag';
  id: number;
  student_id: number;
  student_name: string | null;
  assistant_name: string | null;
  submitted_at: string | null;
  // report
  type_label?: string;
  severity?: 'standard' | 'safety_critical';
  description?: string;
  // flag
  parent_name?: string | null;
  old_number?: string | null;
  reason?: string | null;
}

export async function getAssistantReports(): Promise<AssistantReportItem[]> {
  const { data } = await client.get('/teacher/assistant-reports');
  return (data.data ?? data) as AssistantReportItem[];
}

export async function approveAssistantReport(kind: 'report' | 'flag', id: number, note?: string): Promise<void> {
  await client.post(`/teacher/assistant-reports/${kind}/${id}/approve`, note ? { note } : {});
}

export async function rejectAssistantReport(kind: 'report' | 'flag', id: number, note?: string): Promise<void> {
  await client.post(`/teacher/assistant-reports/${kind}/${id}/reject`, note ? { note } : {});
}

export interface TerminationCandidate {
  id: number;
  enrollment_id: number;
  student_id: number;
  student_code: string | null;
  student_name: string | null;
  course_name: string | null;
  absences: number;
  last_absent_at: string | null;
  /** The first absence of the run (servers since 2026-10-12). */
  streak_started_at?: string | null;
  /** Each absent session of the run, newest first. */
  absent_dates?: string[];
  /** The last session they actually came to, if any since joining. */
  last_present_at?: string | null;
  /** The group, for the page's filter (servers since 2026-10-30). */
  schedule_id?: number | null;
  group_label?: string | null;
}

export interface ExcuseItem {
  id: number;
  student_name: string;
  course_name: string | null;
  reason: string | null;
  session_at: string | null;
  created_at: string | null;
}

export interface SwapItem {
  id: number;
  student_name: string;
  from_course: string | null;
  to_course: string | null;
  target_at: string | null;
  remaining: number | null;
  created_at: string | null;
}

/**
 * One review-queue row: the server sends JSON:API items, fields under `attributes`. Reading
 * them off the item itself showed blank cards and sent terminate with no enrolment id
 * (founder 2026-10-13); servers since then also flatten them, this reads either.
 */
function reviewItem(a: any) {
  return { ...a, ...extractAttrs(a), id: Number(a.id) };
}

/** «انتهى تسجيلهم» — an enrolment this teacher ended in the last 30 days. */
export interface EndedEnrollment {
  id: number;
  enrollment_id: number;
  student_id: number;
  student_name: string | null;
  student_code: string | null;
  course_name: string | null;
  schedule_id: number | null;
  group_label: string | null;
  ended_at: string | null;
  /** False when the student is already back in that course. */
  can_reactivate: boolean;
  /** Nobody in the family ever claimed the account: days before it is deleted. Null = not at risk. */
  deletes_in_days: number | null;
}

export async function getEndedEnrollments(): Promise<EndedEnrollment[]> {
  const { data } = await client.get('/teacher/ended-enrollments');
  return extractList(data, 'ended-enrollment').map(reviewItem) as EndedEnrollment[];
}

/** «إعادة التسجيل» — undo a termination: the same enrolment comes back. */
export async function reactivateEnrollment(enrollmentId: number): Promise<void> {
  await client.post(`/teacher/enrollments/${enrollmentId}/reactivate`);
}

export async function getResolutionSummary(): Promise<ResolutionSummary> {
  const data = await homePart('resolution', () => client.get('/teacher/resolution/summary').then((r) => r.data));
  return (data.data ?? data) as ResolutionSummary;
}

export async function getPendingExcuses(): Promise<ExcuseItem[]> {
  const { data } = await client.get('/teacher/excuses');
  return extractList(data, 'absence-excuse').map(reviewItem) as ExcuseItem[];
}

export async function approveExcuse(id: number): Promise<void> {
  await client.post(`/teacher/excuses/${id}/approve`);
}

export async function rejectExcuse(id: number): Promise<void> {
  await client.post(`/teacher/excuses/${id}/reject`);
}

export async function getPendingSwaps(): Promise<SwapItem[]> {
  const { data } = await client.get('/teacher/session-swaps/pending');
  return extractList(data, 'session-swap').map(reviewItem) as SwapItem[];
}

export async function approveSwap(id: number): Promise<void> {
  await client.post(`/teacher/session-swaps/${id}/approve`);
}

export async function rejectSwap(id: number): Promise<void> {
  await client.post(`/teacher/session-swaps/${id}/reject`);
}

/** Students with 3 consecutive unexcused absences — flagged for the teacher to confirm termination. */
export async function getTerminationCandidates(): Promise<TerminationCandidate[]> {
  const { data } = await client.get('/teacher/termination-candidates');
  return extractList(data, 'termination-candidate').map(reviewItem) as TerminationCandidate[];
}

/** Confirm termination of a flagged enrollment (soft-drop + parent notice — same as manual). */
export { terminateEnrollment } from '@/api/enrollments';

// Tier B — family name-correction requests the teacher reviews.
export interface StudentEditReq {
  id: number;
  student_name: string;
  current_name: string;
  proposed_name: string;
  reason: string;
  submitted_by: string;
  created_at: string;
}

/** A student's «wrong parent number» request addressed to this teacher (2026-10-26). */
export interface ParentNumberReq {
  id: number;
  student_id: number;
  student_name: string;
  parent_name: string | null;
  current_number: string;
  proposed_number: string;
  note: string | null;
  created_at: string;
}

export async function getParentNumberRequests(): Promise<ParentNumberReq[]> {
  const { data } = await client.get('/teacher/parent-number-requests');
  return (data.data ?? data ?? []) as ParentNumberReq[];
}

export async function approveParentNumberRequest(id: number): Promise<void> {
  await client.post(`/teacher/parent-number-requests/${id}/approve`);
}

export async function rejectParentNumberRequest(id: number, reason?: string): Promise<void> {
  await client.post(`/teacher/parent-number-requests/${id}/reject`, { reason });
}

export async function getStudentEditRequests(): Promise<StudentEditReq[]> {
  const { data } = await client.get('/teacher/student-edit-requests');
  return (data.data ?? data ?? []) as StudentEditReq[];
}

export async function approveStudentEditRequest(id: number): Promise<void> {
  await client.post(`/teacher/student-edit-requests/${id}/approve`);
}

export async function rejectStudentEditRequest(id: number, reason?: string): Promise<void> {
  await client.post(`/teacher/student-edit-requests/${id}/reject`, { reason });
}
