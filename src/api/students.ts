import client from './client';
import { extractList, extractAttrs } from './utils';

export interface EnrollableSlot {
  id: number;
  label: string;
}

export interface EnrollableClass {
  course_id: number;
  course_name: string;
  academic_session_id: number;
  slots: EnrollableSlot[];
}

export async function getEnrollableClasses(): Promise<EnrollableClass[]> {
  const { data } = await client.get('/teacher/enrollable-classes');
  return extractList(data, 'enrollable-class').map((item: any) => {
    const a = extractAttrs(item);
    return {
      course_id: a.course_id,
      course_name: a.course_name,
      academic_session_id: a.academic_session_id,
      slots: a.slots ?? [],
    } as EnrollableClass;
  });
}

export interface LookupStudent {
  id: number;
  name: string;
  has_card: boolean;
  report_notice: boolean;
  report_notice_message: string | null;
}

export interface LookupResult {
  found: boolean;
  action?: 'use_card' | 'proceed_new';
  student?: LookupStudent | null;
  reason?: string | null;
}

// Lookup a student by scanned card (QR/serial). Existing → student; unknown → miss.
export async function lookupStudent(method: 'qr' | 'code', value: string, courseId: number): Promise<LookupResult> {
  const { data } = await client.post('/students/lookup', { method, value, course_id: courseId });
  return (data.data ?? data) as LookupResult;
}

export interface EnrollResult {
  enrollment_id: number;
  student_id: number;
  report_notice?: boolean;
}

// Enroll an existing student into the course (schedule master) from their scanned
// card. Enrollment is course-level; the home slot is auto-bound server-side when
// the course has a single weekly slot.
export async function enrollByCard(payload: {
  method: 'qr' | 'code';
  value: string;
  course_id: number;
  academic_session_id: number;
  session_schedule_id?: number;
}): Promise<EnrollResult> {
  const { data } = await client.post('/students/enroll-by-card', payload);
  return (data.data ?? data) as EnrollResult;
}
