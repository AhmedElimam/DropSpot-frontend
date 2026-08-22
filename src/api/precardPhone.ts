import client from './client';
import { extractAttrs } from './utils';

/**
 * §3 — Phone pre-card invitation. For an ALREADY-REGISTERED student with no
 * physical card yet: the teacher sends an invite by phone; the family accepts it
 * in-app (no card handoff needed). A carded student is turned away to use the
 * card; a no-card match and a no-match-at-all return the SAME neutral response so
 * the teacher can't probe who's on the system.
 */
export interface PrecardPhoneSendResult {
  found: boolean;
  action: 'use_card' | 'invitation_sent' | 'already_enrolled';
  message?: string;
}

export async function sendPrecardPhone(payload: {
  phone: string;
  course_id: number;
  academic_session_id: number;
  session_schedule_id?: number;
  /** Optional — names the invited student for a brand-new-family fall-through
   *  (a number that matches no existing student). Ignored for a card-less match. */
  invited_student_name?: string;
  // Per-invitation booking down-payment (blank/undefined = none). Applied at accept.
  down_payment_amount?: number | null;
  /** Already collected up front — seeds paid_amount so the family sees the remainder. */
  down_payment_paid?: number | null;
  // What the down-payment secures (session | booklet | flat). Drives the label.
  booking_secures?: 'session' | 'booklet' | 'flat';
}): Promise<PrecardPhoneSendResult> {
  const { data } = await client.post('/precard-phone-invitations/send', payload);
  return (data.data ?? data) as PrecardPhoneSendResult;
}

export interface PendingPrecardInvite {
  id: string;
  student_id: string;
  student_name: string;
  teacher_name: string;
  expires_at: string;
}

/** The signed-in parent's pending phone pre-card invitations. */
export async function getPendingPrecardPhone(): Promise<PendingPrecardInvite[]> {
  const { data } = await client.get('/precard-phone-invitations/pending');
  const rows = data.data ?? data;
  return (Array.isArray(rows) ? rows : []).map((r: any) => extractAttrs(r));
}

export async function acceptPrecardPhone(invitationId: string | number): Promise<void> {
  await client.post(`/precard-phone-invitations/${invitationId}/accept`);
}

export async function rejectPrecardPhone(invitationId: string | number): Promise<void> {
  await client.post(`/precard-phone-invitations/${invitationId}/reject`);
}
