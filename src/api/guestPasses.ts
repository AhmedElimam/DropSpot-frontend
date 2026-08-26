import client from './client';

export interface IssueGuestPassInput {
  name: string;
  phone?: string;
  feeAmount?: number; // flat one-off fee; omit for a free pass
  paidNow?: boolean; // fee collected at the door now
}

export interface GuestPassResult {
  success: boolean;
  message?: string;
  code?: string;
  name?: string;
  slip_url?: string; // printable/on-screen slip (QR + Code128) — open in a browser
}

/**
 * Issue a session-scoped GUEST PASS for a revision/special session instance — a
 * one-time credential that creates no student/account. Returns a signed slip URL
 * (QR + Code128) to display on-screen for an immediate scan or to print.
 * Teacher, or an assistant granted `issue_guest_passes` (server-enforced).
 */
export async function issueGuestPass(
  revisionId: number,
  instanceId: number,
  input: IssueGuestPassInput,
): Promise<GuestPassResult> {
  try {
    const { data } = await client.post(`/revisions/${revisionId}/guest-passes`, {
      revision_session_instance_id: instanceId,
      name: input.name,
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.feeAmount != null ? { fee_amount: input.feeAmount } : {}),
      paid_now: input.paidNow ? 1 : 0,
    });
    return data as GuestPassResult;
  } catch (e) {
    const d = (e as any)?.response?.data;
    if (d) return { success: false, message: d.message ?? '', code: d.code };
    throw e;
  }
}
