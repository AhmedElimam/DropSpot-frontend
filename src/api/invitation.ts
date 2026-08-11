import client from './client';
import { extractAttrs } from './utils';
import type { AuthResponse } from '@/types/user';

/**
 * §1 — Enrollment invitation opened from the SMS link (drosspot://invite/{token}).
 * A student-centric invite lets the student set a password and become the primary
 * app user; a legacy parent-centric invite is handled on the web/parent flow.
 */
export interface InvitationInfo {
  token: string;
  student_centric: boolean;
  invited_student_name: string | null;
  course_name: string | null;
  teacher_name: string | null;
  student_phone: string | null;
  parent_phone: string | null;
}

/** Public: read the invitation context for the accept screen. */
export async function getInvitation(token: string): Promise<InvitationInfo> {
  const { data } = await client.get(`/invitations/${token}`);
  return extractAttrs(data.data ?? data);
}

/**
 * Student-centric accept: the student sets a password and is logged straight into
 * the student app. `name` is only needed when the teacher didn't set one.
 */
export async function acceptStudentInvite(
  token: string,
  payload: { password: string; name?: string },
): Promise<AuthResponse> {
  const { data } = await client.post(`/invitations/${token}/accept`, payload);
  return extractAttrs(data.data ?? data);
}
