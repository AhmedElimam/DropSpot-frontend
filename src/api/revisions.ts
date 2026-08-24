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
  purpose?: 'revision' | 'quiz_exam';
  is_quiz_exam?: boolean;
  max_mark?: number | null;
  instance_id: number | null;
  scheduled_at: string | null;
}

export interface RevisionAttendee {
  id: number;
  student_id: number;
  student_name: string;
  status: string;
  is_guest: boolean;
  mark: number | null;
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

// ---- Creation (mobile parity for revise/create) ----

export interface RevisionCreateSchedule { id: number; label: string }
export interface RevisionCreateCourse { course_id: number; name: string; slots_label?: string; schedules: RevisionCreateSchedule[] }
export interface RevisionCreateGrade { grade_id: number; grade_name: string; courses: RevisionCreateCourse[] }

/** The teacher's grades → courses → mergeable schedules (the merge picker data). */
export async function getRevisionCreateOptions(): Promise<RevisionCreateGrade[]> {
  const { data } = await client.get('/revisions/create-options');
  return (data.data?.grades ?? data.grades ?? []) as RevisionCreateGrade[];
}

export interface CreateRevisionPayload {
  title: string;
  grade_id: number;
  purpose: 'revision' | 'quiz_exam';
  max_mark?: number | null;
  billing_mode: BillingMode;
  fee_total?: number | null;
  /** COURSE-level selection — every weekly slot of each course is merged in. */
  course_ids: number[];
  is_recurring: boolean;
  day_of_week?: number | null;
  start_time?: string | null; // HH:mm
  end_time?: string | null;   // HH:mm
  one_time_at?: string | null; // 'YYYY-MM-DD HH:mm'
  duration_minutes: number;
  location?: string | null;
  notify_students: boolean;
}

export async function createRevision(payload: CreateRevisionPayload): Promise<{ id: number; title: string; is_quiz_exam: boolean }> {
  const { data } = await client.post('/revisions', payload);
  return (data.data ?? data) as { id: number; title: string; is_quiz_exam: boolean };
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

// §2 quiz_exam marks — list an instance's attendees, then record per-student marks.
export async function getRevisionAttendees(
  revisionId: number,
  instanceId: number,
): Promise<{ max_mark: number | null; title: string; attendees: RevisionAttendee[] }> {
  const { data } = await client.get(`/revisions/${revisionId}/instances/${instanceId}/attendees`);
  const d = data.data ?? data;
  return { max_mark: d.max_mark ?? null, title: d.title ?? '', attendees: (d.attendees ?? []) as RevisionAttendee[] };
}

export async function recordRevisionMark(
  revisionId: number,
  instanceId: number,
  studentId: number,
  mark: number | null,
): Promise<void> {
  await client.post(`/revisions/${revisionId}/instances/${instanceId}/mark`, {
    student_id: studentId,
    mark: mark === null ? '' : mark,
  });
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
