import client from './client';

/**
 * «اعتراض» — a student disputing a record about them: an attendance mark on one session
 * («I was there» / «I was not») or an invoice they say they paid that was never recorded.
 * Staff (teacher, or an assistant with the matching ability) approve or reject; an
 * assistant's decision then waits in the teacher's review bucket.
 */
export type ComplaintType = 'attendance' | 'payment';
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
  decided_by_name: string | null;
  decided_by_teacher: boolean;
  decided_at: string | null;
  decision_note: string | null;
  teacher_reviewed_at: string | null;
  created_at: string | null;
}

export type ComplaintBucket = 'pending' | 'review' | 'history';

export interface ComplaintList {
  rows: Complaint[];
  counts: { pending: number; review: number };
  can_decide: { attendance: boolean; payment: boolean };
}

const row = (r: any): Complaint => ({ ...(r.attributes ?? r), id: Number(r.id ?? r.attributes?.id) });

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
    rows: ((d.rows ?? []) as any[]).map((r) => ({ ...r, id: Number(r.id) })),
    counts: { pending: Number(d.counts?.pending ?? 0), review: Number(d.counts?.review ?? 0) },
    can_decide: { attendance: !!d.can_decide?.attendance, payment: !!d.can_decide?.payment },
  };
}

export async function approveComplaint(id: number): Promise<void> {
  await client.post(`/teacher/complaints/${id}/approve`);
}

export async function rejectComplaint(id: number, note?: string): Promise<void> {
  await client.post(`/teacher/complaints/${id}/reject`, note ? { note } : {});
}

export async function reviewComplaint(id: number): Promise<void> {
  await client.post(`/teacher/complaints/${id}/review`);
}
