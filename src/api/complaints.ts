import client from './client';
import { parseAnnotations, serialiseAnnotations, type PhotoAnnotations } from '@/components/complaints/annotationGeometry';

/**
 * «اعتراض» — a student disputing a record about them: an attendance mark on one session
 * («I was there» / «I was not»), an invoice they say they paid that was never recorded, or
 * a GRADE («اعتراض على الدرجة», 2026-10-05) — a session mark or a merged exam, optionally
 * with the mark they say is right and a photo of the paper they drew on.
 * Staff (teacher, or an assistant with the matching ability) approve or reject; an
 * assistant's decision then waits in the teacher's review bucket.
 */
export type ComplaintType = 'attendance' | 'payment' | 'grade';
export type ComplaintStatus = 'pending' | 'approved' | 'rejected';
export type ComplaintClaim = 'present' | 'absent';

export interface Complaint {
  id: number;
  type: ComplaintType;
  status: ComplaintStatus;
  claim: ComplaintClaim | null;
  note: string | null;
  student_id: number;
  student_name: string | null;
  /** Filed by a parent on the student's behalf (else by the student). */
  filed_by_parent: boolean;
  filed_by_name: string | null;
  session_instance_id: number | null;
  course_name: string | null;
  session_at: string | null;
  recorded_status: string | null;
  invoice_id: number | null;
  invoice_number: string | null;
  invoice_amount: number | null;
  /** Still due on the invoice now — the most a payment complaint can record. */
  invoice_remaining?: number | null;
  // ---- payment complaints: what the family stated, and what was approved ----
  paid_method?: PaidMethod | null;
  claimed_amount?: number | null;
  approved_amount?: number | null;
  /** cash = into the receiver's drawer; digital = a transfer, into no drawer. */
  approved_method?: LedgerMethod | null;
  received_by_name?: string | null;
  decided_by_name: string | null;
  decided_by_teacher: boolean;
  decided_at: string | null;
  decision_note: string | null;
  teacher_reviewed_at: string | null;
  created_at: string | null;
  // ---- grade complaints (null on the other kinds) ----
  /** 'session' = a session mark (sheet or single-session exam); 'revision' = a merged exam. */
  grade_source?: GradeSource | null;
  attendance_record_id?: number | null;
  revision_attendance_id?: number | null;
  exam_title?: string | null;
  recorded_mark?: number | null;
  claimed_mark?: number | null;
  max_mark?: number | null;
  corrected_mark?: number | null;
  /** A short-lived signed link — load it straight into an Image (no auth header). */
  photo_url?: string | null;
  photo_annotations?: PhotoAnnotations | null;
}

export type GradeSource = 'session' | 'revision';

/** How the family says they paid. A transfer never enters a cash drawer. */
export type PaidMethod = 'cash' | 'vodafone_cash' | 'instapay';
export type LedgerMethod = 'cash' | 'digital';
export const ledgerMethodFor = (m?: PaidMethod | null): LedgerMethod | null =>
  m === 'cash' ? 'cash' : m === 'vodafone_cash' || m === 'instapay' ? 'digital' : null;

/** Someone a decider may name as having received disputed cash (themselves, the teacher, or — for the teacher — an assistant). */
export interface CashReceiver { id: number; name: string; is_me: boolean }

/** The slim complaint state each grade / exam result carries (`complaint` on the row). */
export interface GradeComplaintState {
  id: number;
  status: ComplaintStatus;
  claimed_mark: number | null;
  corrected_mark: number | null;
  decision_note: string | null;
}

export type ComplaintBucket = 'pending' | 'review' | 'history';

export interface ComplaintList {
  rows: Complaint[];
  counts: { pending: number; review: number };
  can_decide: { attendance: boolean; payment: boolean; grade: boolean };
  receivers: CashReceiver[];
}

const num = (v: any): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

const row = (r: any): Complaint => {
  const a = r.attributes ?? r;
  return {
    ...a,
    id: Number(r.id ?? a.id),
    recorded_mark: num(a.recorded_mark),
    claimed_mark: num(a.claimed_mark),
    max_mark: num(a.max_mark),
    corrected_mark: num(a.corrected_mark),
    invoice_remaining: num(a.invoice_remaining),
    claimed_amount: num(a.claimed_amount),
    approved_amount: num(a.approved_amount),
    photo_annotations: a.photo_annotations ? parseAnnotations(a.photo_annotations) : null,
  };
};

// ---- student ----

export async function getMyComplaints(): Promise<Complaint[]> {
  const { data } = await client.get('/students/complaints');
  return ((data?.data ?? []) as any[]).map(row);
}

export interface FileComplaintInput {
  type: ComplaintType;
  session_instance_id?: number;
  invoice_id?: number;
  claim?: ComplaintClaim;
  /** Payment: how they paid, and how much (≤ what is still due; a part for a part-paid invoice). */
  paid_method?: PaidMethod;
  claimed_amount?: number;
  note?: string;
  /** Parent only: which child this is about. Routes the call to the parent endpoint. */
  student_id?: number;
}

/** Files as the student, or — when `student_id` is given — as a parent for that child. */
export async function fileComplaint(input: FileComplaintInput): Promise<Complaint> {
  const { data } = input.student_id
    ? await client.post('/parents/complaints', input)
    : await client.post('/students/complaints', input);
  return row(data.data);
}

export interface FileGradeComplaintInput {
  /** A session mark (sheet or single-session exam) — exactly one of these two. */
  attendance_record_id?: number;
  /** A merged (revision) exam. */
  revision_attendance_id?: number;
  /** The mark the family says is right (0..max, not the recorded one). */
  claimed_mark?: number;
  note?: string;
  /** The exam paper, from the camera or the gallery. */
  photo?: { uri: string; name?: string | null; mimeType?: string | null } | null;
  /** What they drew on the photo. Sent only with a photo. */
  annotations?: PhotoAnnotations | null;
  /** Parent only: which child. Routes the call to the parent endpoint. */
  student_id?: number;
}

const PHOTO_MIME: Record<string, string> = {
  png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', jpg: 'image/jpeg', jpeg: 'image/jpeg',
};

/**
 * «اعتراض على الدرجة» — as the student, or as a parent for `student_id`. With a photo the
 * call is multipart (the paper + the drawing as a JSON string); without one it is JSON.
 */
export async function fileGradeComplaint(input: FileGradeComplaintInput): Promise<Complaint> {
  const url = input.student_id ? '/parents/complaints' : '/students/complaints';
  const fields: Record<string, string | number | undefined> = {
    type: 'grade',
    student_id: input.student_id,
    attendance_record_id: input.attendance_record_id,
    revision_attendance_id: input.revision_attendance_id,
    claimed_mark: input.claimed_mark,
    note: input.note?.trim() || undefined,
  };
  if (!input.photo) {
    const body = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    const { data } = await client.post(url, body);
    return row(data.data);
  }
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.append(k, String(v));
  const fromUri = input.photo.uri.split('?')[0].split('/').pop() || 'paper.jpg';
  const name = input.photo.name || fromUri;
  const ext = (name.split('.').pop() || 'jpg').toLowerCase();
  // The true MIME (an iPhone gallery hands over HEIC — mislabelling it broke uploads before).
  const type = input.photo.mimeType || PHOTO_MIME[ext] || 'image/jpeg';
  form.append('photo', { uri: input.photo.uri, name: name.includes('.') ? name : `${name}.jpg`, type } as any);
  const annotations = serialiseAnnotations(input.annotations);
  if (annotations) form.append('annotations', annotations);
  const { data } = await client.post(url, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // A paper photo on a slow line takes longer than the default ceiling.
    timeout: 120_000,
  });
  return row(data.data);
}

// ---- parent ----

/** Every complaint on any of the parent's children, filed by them or by the child. */
export async function getFamilyComplaints(): Promise<Complaint[]> {
  const { data } = await client.get('/parents/complaints');
  return ((data?.data ?? []) as any[]).map(row);
}

// ---- teacher / assistant ----

export async function getComplaints(bucket: ComplaintBucket = 'pending'): Promise<ComplaintList> {
  const { data } = await client.get('/teacher/complaints', { params: { bucket } });
  const d = data?.data ?? {};
  return {
    rows: ((d.rows ?? []) as any[]).map(row),
    counts: { pending: Number(d.counts?.pending ?? 0), review: Number(d.counts?.review ?? 0) },
    can_decide: { attendance: !!d.can_decide?.attendance, payment: !!d.can_decide?.payment, grade: !!d.can_decide?.grade },
    receivers: ((d.receivers ?? []) as any[]).map((r) => ({ id: Number(r.id), name: String(r.name ?? ''), is_me: !!r.is_me })),
  };
}

export interface ApproveInput {
  /** Grade: the corrected mark (the server defaults to the one asked for). */
  mark?: number;
  /** Payment: the amount really paid (≤ what is still due). */
  amount?: number;
  /** Payment: cash (into a drawer) or digital (a transfer — no drawer). */
  method?: LedgerMethod;
  /** Payment, cash only: who received it (defaults to the decider). */
  received_by?: number;
}

export async function approveComplaint(id: number, input: ApproveInput = {}): Promise<void> {
  const body = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  await client.post(`/teacher/complaints/${id}/approve`, body);
}

export async function rejectComplaint(id: number, note?: string): Promise<void> {
  await client.post(`/teacher/complaints/${id}/reject`, note ? { note } : {});
}

export async function reviewComplaint(id: number): Promise<void> {
  await client.post(`/teacher/complaints/${id}/review`);
}
