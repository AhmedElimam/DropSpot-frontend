import client from './client';

/**
 * Revision-session scanning for the teacher app — the api/v1 counterpart to the
 * web revise kiosk. Online-only by design (no offline buffering): the backend
 * creates guest records, sends SMS, and splits spread fees, none of which
 * reconcile cleanly from a buffer.
 */

export type BillingMode = 'free' | 'bucket' | 'spread';

export interface RevisionSummary {
  id: number;
  title: string;
  billing_mode: BillingMode;
  instance_id: number | null;
  scheduled_at: string | null;
}

export interface RevisionScanResult {
  success: boolean;
  message: string;
  student_name?: string | null;
  /** Present when a scanned card is off-roster and a one-time guest may be added. */
  code?: string;
  student?: { id: number; name: string };
  billing_mode?: BillingMode;
  guest?: boolean;
  billed?: boolean;
  created?: boolean;
}

export async function getRevisions(): Promise<RevisionSummary[]> {
  const { data } = await client.get('/revisions');
  return (data?.data?.revisions ?? []) as RevisionSummary[];
}

// A validation failure (422) throws in axios; surface its body in the same shape
// so callers get one consistent result object. A 200 with success:false (the
// NOT_ON_ROSTER guest prompt) is returned directly, not thrown.
function unwrap(e: any): RevisionScanResult {
  const d = e?.response?.data;
  if (d) {
    return { success: false, message: d.message ?? '', code: d.code, student: d.student, billing_mode: d.billing_mode };
  }
  throw e;
}

export async function scanRevision(revisionId: number, instanceId: number, cardCode: string): Promise<RevisionScanResult> {
  try {
    const { data } = await client.post(`/revisions/${revisionId}/scan`, {
      card_code: cardCode,
      revision_session_instance_id: instanceId,
    });
    return data as RevisionScanResult;
  } catch (e) {
    return unwrap(e);
  }
}

export async function addRevisionGuest(revisionId: number, instanceId: number, studentId: number): Promise<RevisionScanResult> {
  try {
    const { data } = await client.post(`/revisions/${revisionId}/guest`, {
      student_id: studentId,
      revision_session_instance_id: instanceId,
    });
    return data as RevisionScanResult;
  } catch (e) {
    return unwrap(e);
  }
}

export async function addRevisionGuestByPhone(
  revisionId: number,
  instanceId: number,
  name: string,
  phone: string,
): Promise<RevisionScanResult> {
  try {
    const { data } = await client.post(`/revisions/${revisionId}/guest-phone`, {
      name,
      phone,
      revision_session_instance_id: instanceId,
    });
    return data as RevisionScanResult;
  } catch (e) {
    return unwrap(e);
  }
}
