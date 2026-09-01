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
  id: number;
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
  /** Teacher can remove this TERMINATED (dropped, still-visible) student from the roster now. */
  can_remove_from_roster?: boolean;
  attendance_stats: { total: number; attended: number; absent: number; excused: number };
  attendance: StudentAttendanceRow[];
  billing: {
    has_overdue: boolean;
    overdue_amount: string;
    override_active: boolean;
    override_expires_at: string | null;
    /** Teacher-wide 15-day-allowance switch. */
    allowance_enabled?: boolean;
    /** This student is blocked from the 15-day allowance under this teacher. */
    allowance_blocked?: boolean;
    /** FULL pending collection (superset of the overdue slice): bill + booklet + booking. */
    pending_total?: string;
    has_pending?: boolean;
    pending?: { bill: string; booklet: string; booking: string };
    /** Collected charges the teacher can CANCEL (per-charge). Empty for assistants. */
    collected?: { kind: 'bill' | 'booklet' | 'booking'; id: number; label: string; paid: string }[];
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
 * Cancel a specific collected payment for a student (restores the due). Teacher-only on
 * the server (assistants get 403). Audited, no SMS.
 */
export async function reverseStudentPayment(
  studentId: string | number,
  kind: 'bill' | 'booklet' | 'booking',
  chargeId?: number,
): Promise<void> {
  await client.post(`/teacher/students/${studentId}/reverse-payment`, {
    kind,
    ...(chargeId != null ? { charge_id: chargeId } : {}),
  });
}

/**
 * Remove a TERMINATED student from the roster now (before the 7-day grace elapses). Hides
 * the dropped enrollment; the student's profile and any outstanding bill are untouched.
 * Teacher OR an assistant with manage_students.
 */
export async function removeStudentFromRoster(studentId: string | number): Promise<void> {
  await client.post(`/teacher/students/${studentId}/remove-from-roster`);
}

/**
 * Mint a short-lived SIGNED URL for this student's performance PDF. The teacher is
 * authenticated here (Bearer) and the scope is baked into the signature; the returned
 * 5-minute link is opened in the external browser (which can't carry the token).
 */
export async function getStudentPerformanceUrl(id: string | number): Promise<string> {
  const { data } = await client.get(`/teacher/students/${id}/performance-pdf-url`);
  return data?.data?.url ?? data?.url;
}

/**
 * The teacher/assistant called the parent and got no answer → nudge the student
 * (in-app + push) to relay that their teacher urgently needs to reach the parent.
 */
export async function reportParentUnreachable(studentId: string | number): Promise<void> {
  await client.post(`/teacher/students/${studentId}/parent-unreachable`);
}

/**
 * REQUEST a name/phone correction for a student → super-admin review. There is no direct
 * teacher edit (a student is a shared global identity and the phone is a login credential).
 * Send only the field(s) to change; `reason` is required.
 */
export async function requestStudentEdit(
  studentId: string | number,
  payload: { first_name?: string; last_name?: string; phone?: string; reason: string },
): Promise<void> {
  await client.post(`/teacher/students/${studentId}/edit-request`, payload);
}

export type IncidentType = 'behavioral' | 'communication' | 'attendance_discipline' | 'other';
export type SafetyCategory = 'weapon' | 'physical_violence' | 'other_immediate_danger';

/**
 * Submit an INCIDENT report about a student → super-admin review (teacher-only, tiered).
 * A safety-critical report needs a `safety_category` and triggers expedited review.
 */
export async function reportStudentIncident(
  studentId: string | number,
  payload: { description: string; report_type?: IncidentType; severity?: 'standard' | 'safety_critical'; safety_category?: SafetyCategory },
): Promise<void> {
  await client.post(`/teacher/students/${studentId}/report`, payload);
}

/**
 * Report a parent's phone as fake/misleading → super-admin review; once confirmed the
 * warning shows to every teacher who shares the student. Teacher-only.
 */
export async function flagParentNumber(
  studentId: string | number,
  payload: { parent_id: number; reason?: string },
): Promise<void> {
  await client.post(`/teacher/students/${studentId}/flag-parent-number`, payload);
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

export interface MintedCardOrderLink {
  id: number;
  token: string;
  url: string;
  expires_at: string;
}

/**
 * Mint a single-use card-order PORTAL link to hand a not-yet-enrolled family
 * (mobile parity for the web card-orders.generate). The family fills the order
 * with no OTP; it lands in the super-admin review queue. Takes no input.
 */
export async function mintCardOrderLink(): Promise<MintedCardOrderLink> {
  const { data } = await client.post('/teacher/card-orders/generate-link');
  return (data.data ?? data) as MintedCardOrderLink;
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

// ---------------------------------------------------------------------------
// Tier B — family (student/parent) name-correction requests → teacher review.
// ---------------------------------------------------------------------------

export async function submitMyNameCorrection(payload: { first_name?: string; last_name?: string; reason: string }): Promise<void> {
  await client.post('/me/student-edit-request', payload);
}

export async function submitChildNameCorrection(
  studentId: string | number,
  payload: { first_name?: string; last_name?: string; reason: string },
): Promise<void> {
  await client.post(`/parent/children/${studentId}/edit-request`, payload);
}
