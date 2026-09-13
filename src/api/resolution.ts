import client from './client';
import { extractList } from './utils';

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

export async function getResolutionSummary(): Promise<ResolutionSummary> {
  const { data } = await client.get('/teacher/resolution/summary');
  return (data.data ?? data) as ResolutionSummary;
}

export async function getPendingExcuses(): Promise<ExcuseItem[]> {
  const { data } = await client.get('/teacher/excuses');
  return extractList(data, 'absence-excuse').map((a: any) => ({ id: Number(a.id), ...a })) as ExcuseItem[];
}

export async function approveExcuse(id: number): Promise<void> {
  await client.post(`/teacher/excuses/${id}/approve`);
}

export async function rejectExcuse(id: number): Promise<void> {
  await client.post(`/teacher/excuses/${id}/reject`);
}

export async function getPendingSwaps(): Promise<SwapItem[]> {
  const { data } = await client.get('/teacher/session-swaps/pending');
  return extractList(data, 'session-swap').map((a: any) => ({ id: Number(a.id), ...a })) as SwapItem[];
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
  return extractList(data, 'termination-candidate').map((a: any) => ({ id: Number(a.id), ...a })) as TerminationCandidate[];
}

/** Confirm termination of a flagged enrollment (soft-drop + parent notice — same as manual). */
export async function terminateEnrollment(enrollmentId: number): Promise<void> {
  await client.post(`/teacher/enrollments/${enrollmentId}/terminate`);
}

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
