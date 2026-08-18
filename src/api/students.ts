import client from './client';
import { extractList, extractAttrs } from './utils';

export interface EnrollableSlot {
  id: number;
  label: string;
}

export type BookingSecures = 'session' | 'booklet' | 'flat';

export interface EnrollableClass {
  course_id: number;
  course_name: string;
  academic_session_id: number;
  slots: EnrollableSlot[];
  // Booking down-payment: the teacher's default + the price bases for prefill.
  booking_secures_default: BookingSecures;
  price_session: number | null;
  price_booklet: number | null;
  price_flat: number | null;
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
      booking_secures_default: (a.booking_secures_default ?? 'flat') as BookingSecures,
      price_session: a.price_session ?? null,
      price_booklet: a.price_booklet ?? null,
      price_flat: a.price_flat ?? null,
    } as EnrollableClass;
  });
}

export interface DisclosureFlag {
  label: string;
  color: string;
  tooltip?: string | null;
}

export interface LookupStudent {
  id: number;
  name: string;
  has_card: boolean;
  report_notice: boolean;
  report_notice_message: string | null;
  // A confirmed report's cross-tenant colored flag (null → fixed message fallback).
  report_flag?: DisclosureFlag | null;
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
  /** Confirm enrolling a student whose saved grade differs from the course's. */
  accept_grade_mismatch?: boolean;
}): Promise<EnrollResult> {
  const { data } = await client.post('/students/enroll-by-card', payload);
  return (data.data ?? data) as EnrollResult;
}

// ---------------------------------------------------------------------------
// Teacher "الطلاب" tab: roster (filter/order by grade), grades filter list, and
// a per-student profile (core + billing). All server-scoped to the teacher.
// ---------------------------------------------------------------------------

export interface RosterStudent {
  id: string;
  name: string | null;
  student_code: string | null;
  grade_id: number | null;
  grade_name: string | null;
  attendance_total: number;
  attendance_attended: number;
  attendance_rate: number | null;
}

export interface TeacherCourse {
  id: number;
  name: string;
}

export interface StudentCourse {
  id: number;
  name: string | null;
  enrollment_id?: number;
}

export interface StudentParent {
  name: string | null;
  phone: string | null;
  relationship: string | null;
  is_primary: boolean;
  phone_verified?: boolean;
  number_flagged?: boolean;
}

export interface StudentAttendanceRow {
  id: number;
  course_name: string | null;
  date: string | null;
  status: string;
  method: string | null;
}

export interface StudentDetail {
  id: string;
  name: string | null;
  student_code: string | null;
  grade_name: string | null;
  courses: StudentCourse[];
  parents: StudentParent[];
  parent_number_notice?: boolean;
  parent_number_notice_message?: string | null;
  attendance_stats: { total: number; attended: number; absent: number; excused: number };
  attendance: StudentAttendanceRow[];
  billing: {
    has_overdue: boolean;
    overdue_amount: string;
    override_active: boolean;
    override_expires_at: string | null;
  };
}

export async function getTeacherStudents(params?: { course_id?: number; q?: string }): Promise<RosterStudent[]> {
  const { data } = await client.get('/teacher/students', { params });
  return extractList(data, 'teacher-student').map((item: any) => {
    const attrs = extractAttrs(item);
    return { ...attrs, id: String(item.id ?? attrs.id) } as RosterStudent;
  });
}

export async function getTeacherCourses(): Promise<TeacherCourse[]> {
  const { data } = await client.get('/teacher/students/courses');
  return (data.data ?? data ?? []) as TeacherCourse[];
}

export async function getStudentDetail(id: string | number): Promise<StudentDetail> {
  const { data } = await client.get(`/teacher/students/${id}`);
  return (data.data ?? data) as StudentDetail;
}

/**
 * The teacher/assistant called the parent and got no answer → nudge the student
 * (in-app + push) to relay that their teacher urgently needs to reach the parent.
 */
export async function reportParentUnreachable(studentId: string | number): Promise<void> {
  await client.post(`/teacher/students/${studentId}/parent-unreachable`);
}

// ---------------------------------------------------------------------------
// Card orders raised for an existing enrollment (roster "cards" segment).
// ---------------------------------------------------------------------------

export interface TeacherCardOrder {
  id: number;
  student_name: string;
  status: 'submitted' | 'approved' | 'rejected' | 'link_generated';
  payment_option: string | null;
  grade_label: string | null;
  course_name: string | null;
  created_at: string | null;
}

export async function getTeacherCardOrders(): Promise<TeacherCardOrder[]> {
  const { data } = await client.get('/teacher/card-orders');
  return (data.data ?? data ?? []) as TeacherCardOrder[];
}

export interface OrderCardPayload {
  enrollment_id: number;
  delivery_address: string;
  payment_option: 'cash_on_delivery' | 'pay_now';
  imageUri?: string | null; // pay-now proof screenshot
}

export async function orderCardForEnrollment(payload: OrderCardPayload): Promise<{ id: number; status: string }> {
  const form = new FormData();
  form.append('enrollment_id', String(payload.enrollment_id));
  form.append('delivery_address', payload.delivery_address);
  form.append('payment_option', payload.payment_option);
  if (payload.payment_option === 'pay_now' && payload.imageUri) {
    const name = payload.imageUri.split('/').pop() || 'proof.jpg';
    const ext = (name.split('.').pop() || 'jpg').toLowerCase();
    form.append('screenshot', { uri: payload.imageUri, name, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` } as any);
  }
  const { data } = await client.post('/teacher/card-orders', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return (data.data ?? data) as { id: number; status: string };
}
