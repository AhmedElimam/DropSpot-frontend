import client from './client';

/** Fast door-side recording — name + parent phone → dormant student (activates later). */
export interface RecordStudentPayload {
  student_name: string;
  parent_phone: string;
  student_phone?: string | null;
  course_id: number;
  dedupe_decision?: 'new' | 'link';
  link_student_id?: number;
}

export interface RecordStudentResult {
  student_id: number;
  enrollment_id: number | null;
  parent_user_id?: number;
  is_new_parent?: boolean;
  linked?: boolean;
}

/** A duplicate-parent-phone match — id + name ONLY (never the other teacher's data). */
export interface DedupeMatch {
  id: number;
  name: string;
}

export async function recordStudent(payload: RecordStudentPayload): Promise<RecordStudentResult> {
  const { data } = await client.post('/teacher/students/record', payload);
  return (data.data ?? data) as RecordStudentResult;
}

export async function orderCardsForNewlyAdded(enrollmentIds: number[]): Promise<{ created: number; skipped: number }> {
  const { data } = await client.post('/teacher/students/record/order-cards', { enrollment_ids: enrollmentIds });
  return (data.data ?? data) as { created: number; skipped: number };
}
