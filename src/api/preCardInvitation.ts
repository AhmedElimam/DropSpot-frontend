import client from './client';
import type { EnrollmentTermsInput } from './enrollmentTerms';

/**
 * Pre-Card Invitation Token (spec). A parent mints a one-time, short-lived QR for
 * a child who has an account but no physical card yet; a teacher scans it in
 * person (reserve) and confirms (enroll). This channel is enrollment-only — it
 * never grants attendance capability.
 */

// ---- Parent side ----------------------------------------------------------

export interface PreCardToken {
  invitation_id: number;
  token: string;          // encoded into the QR the teacher scans
  numeric_code: string;   // typed fallback if the camera won't read the QR
  student_name: string;
  expires_at: string;
  expires_in_seconds: number;
}

export async function generatePreCard(studentId: number): Promise<PreCardToken> {
  const { data } = await client.post(`/children/${studentId}/pre-card-invitation`);
  return (data.data ?? data) as PreCardToken;
}

// ---- Teacher side ---------------------------------------------------------

export interface PreCardScanStudent {
  id: number;
  name: string;
  grade: string | null;
  report_notice: boolean;
  report_notice_message: string | null;
  report_flag?: { label: string; color: string; tooltip?: string | null } | null;
}

export interface PreCardScanResult {
  invitation_id: number;
  student: PreCardScanStudent;
  expires_at: string;
}

/** Scan a value (QR token or typed numeric code). Reserves the token server-side. */
export async function scanPreCard(value: string): Promise<PreCardScanResult> {
  const { data } = await client.post('/pre-card-invitations/scan', { value });
  return (data.data ?? data) as PreCardScanResult;
}

export interface PreCardConfirmResult {
  enrollment_id: number;
  student_id: number;
  report_notice?: boolean;
}

export async function confirmPreCard(
  invitationId: number,
  // The shared «شروط التسجيل» keys ride along exactly as on enroll-by-card.
  payload: { course_id: number; academic_session_id: number; session_schedule_id?: number } & EnrollmentTermsInput,
): Promise<PreCardConfirmResult> {
  const { data } = await client.post(`/pre-card-invitations/${invitationId}/confirm`, payload);
  return (data.data ?? data) as PreCardConfirmResult;
}

/** Back out of a reservation (teacher rejected before confirming). */
export async function cancelPreCard(invitationId: number): Promise<void> {
  await client.post(`/pre-card-invitations/${invitationId}/cancel`);
}

/**
 * A scan with no connection: the value (pre-card token or card), the course and the terms
 * go to the server as ONE request when the connection returns, which sorts out which it was
 * and enrols (src/api/offlineQueue.ts parks it). Offline it answers «queued» at once.
 */
export async function enrollByScan(
  payload: { value: string; course_id: number; academic_session_id: number; session_schedule_id?: number } & EnrollmentTermsInput,
): Promise<{ enrollment_id?: number; student_id?: number; via?: 'pre_card' | 'card'; queued?: boolean }> {
  const { data } = await client.post('/students/enroll-by-scan', payload);
  return (data.data ?? data) as { enrollment_id?: number; student_id?: number; via?: 'pre_card' | 'card'; queued?: boolean };
}
