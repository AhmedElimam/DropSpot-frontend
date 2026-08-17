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

export interface MintedInviteLink {
  token: string;
  url: string;
  student_name: string;
  course_name: string;
  expires_at: string;
}

/**
 * Teacher mints a single-use invite link for a family (they open it, confirm, and
 * self-register into the chosen course). Mobile parity for the web "رابط مُعبّأ"
 * channel — POST /invitations/link.
 */
export async function mintInviteLink(courseId: number, studentName: string): Promise<MintedInviteLink> {
  const { data } = await client.post('/invitations/link', { course_id: courseId, student_name: studentName });
  return extractAttrs(data.data ?? data);
}

// ---- Phone invitation (full parity with the web /invitations page) ----

export type BookingSecures = 'session' | 'booklet' | 'flat';

export interface InvitationCourseOption {
  id: number;
  name: string;
  grade_id: number | null;
  grade_name: string | null;
  academic_session_id: number | null;
  booking_price: number | null;
  has_schedule: boolean;
  schedule_label: string; // "الأحد 9:00 AM، الثلاثاء 5:00 PM"
}

export interface InvitationOptions {
  courses: InvitationCourseOption[];
  terms: { id: number; name: string; is_current: boolean }[];
  requires_down_payment: boolean;
  default_secures: BookingSecures;
}

export async function getInvitationOptions(): Promise<InvitationOptions> {
  const { data } = await client.get('/teacher/invitation-options');
  return (data.data ?? data) as InvitationOptions;
}

export interface CreateInvitationPayload {
  parent_phone?: string;
  student_phone?: string;
  course_id: number;
  academic_session_id: number;
  grade_id?: number | null;
  invited_student_name?: string;
  dedupe_decision?: 'new' | 'link';
  link_student_id?: number;
  down_payment_amount?: number | null;
  booking_secures?: BookingSecures;
}

export interface DedupeMatch { id: number; name?: string; [k: string]: unknown }

export type CreateInvitationResult =
  | { kind: 'minted'; message: string; smsSent: boolean }
  | { kind: 'linked'; message: string }
  | { kind: 'dedupe'; matches: DedupeMatch[]; message: string };

/**
 * Create a phone invitation. Mirrors the web flow: a parent-phone match returns a
 * DEDUPE prompt (409) so the caller can link the existing student or force "new";
 * a "link" decision enrolls immediately; otherwise a fresh invite is minted + SMS'd.
 */
export async function createInvitation(payload: CreateInvitationPayload): Promise<CreateInvitationResult> {
  try {
    const { data } = await client.post('/invitations', payload);
    if (data.data?.linked_existing) return { kind: 'linked', message: data.message ?? '' };
    const smsSent = !!data.data?.attributes?.sms_sent;
    return { kind: 'minted', message: data.message ?? '', smsSent };
  } catch (e: any) {
    const d = e?.response?.data;
    if (e?.response?.status === 409 && d?.code === 'DEDUPE_REQUIRED') {
      return { kind: 'dedupe', matches: d?.errors?.matches ?? [], message: d?.message ?? '' };
    }
    throw e;
  }
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
