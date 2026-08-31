import client from './client';

/**
 * Teacher courses management — parity with the web /courses + /courses/{id}/edit.
 * List courses, read/update per-course settings, capture the classroom GPS
 * location (which auto-enables phone check-in), and retire weekly slots. All
 * tenant-scoped server-side to the operating teacher; writes need manage_courses.
 */

export interface CourseSummary {
  id: string;
  name: string;
  grade_name: string | null;
  students_count: number;
  radius_horizontal_meters: number | null;
  has_location: boolean;
  phone_checkin_active: boolean;
  slot_count: number;
  upcoming_count: number;
  /** Weekly schedule label — weekday + start time, e.g. «الأحد 9:00 AM، الثلاثاء 5:00 PM». */
  schedule_label?: string;
}

export interface CourseSchedule {
  id: string;
  day_of_week: number;
  day_label: string;
  start_time: string;
  end_time: string;
  capacity: number | null;
  upcoming_count: number;
  headcount: number;
}

export interface CourseDetail {
  id: string;
  name: string;
  grade_name: string | null;
  students_count: number;
  // Settings
  radius_horizontal_meters: number;
  allow_session_swap: boolean;
  sheet_expected_by_default: boolean;
  sheet_max_mark: number | null;
  sessions_per_billing_cycle: number | null;
  cycle_price: number | null;
  booklet_price: number | null;
  booking_price: number | null;
  booklet_is_down_payment?: boolean;
  min_sessions_per_cycle: number;
  max_sessions_per_cycle: number;
  // Location / phone check-in (automated)
  has_location: boolean;
  phone_checkin_active: boolean;
  latitude: number | null;
  longitude: number | null;
  location_accuracy_meters: number | null;
  location_source: string | null;
  location_low_confidence: boolean;
  schedules: CourseSchedule[];
}

export interface CourseSettingsPayload {
  radius_horizontal_meters?: number;
  allow_session_swap?: boolean;
  sheet_expected_by_default?: boolean;
  sheet_max_mark?: number | null;
  sessions_per_billing_cycle?: number;
  cycle_price?: number | null;
  booklet_price?: number | null;
  booking_price?: number | null;
}

export interface LocationPayload {
  latitude: number;
  longitude: number;
  location_accuracy_meters?: number | null;
  location_source?: 'gps' | 'gps_low' | 'manual';
}

// ---- Create (parity with the web create form) ----

export interface CourseFormOptions {
  grades: { id: string; name: string }[];
  terms: { id: string; name: string; ended: boolean; is_current: boolean }[];
  current_term_id: string | null;
  default_radius: number;
  booklet_is_down_payment?: boolean;
}

export interface CreateCoursePayload {
  name: string;
  grade_id: number;
  academic_session_id: number;
  /** "When do you want to start" — ISO date (YYYY-MM-DD). Omit/undefined = start now. */
  starts_at?: string | null;
  code?: string;
  capacity?: number | null;
  radius_horizontal_meters?: number;
  description?: string;
  slots?: { day_of_week: number; start_time: string; end_time: string }[];
  // Per-course session-swap permission (default on).
  allow_session_swap?: boolean;
  // Pricing at creation (empty = disabled/none) — mirrors the web create form.
  sessions_per_billing_cycle?: number;
  cycle_price?: number | null;
  booklet_price?: number | null;
  booking_price?: number | null;
}

export interface CreateCourseResult {
  course: CourseDetail;
  generated: number;
  term_ended: boolean;
}

export async function getCourseFormOptions(): Promise<CourseFormOptions> {
  const { data } = await client.get('/teacher/courses/form-options');
  return (data.data ?? data) as CourseFormOptions;
}

export async function createCourse(payload: CreateCoursePayload): Promise<CreateCourseResult> {
  const { data } = await client.post('/teacher/courses', payload);
  return (data.data ?? data) as CreateCourseResult;
}

export async function getCourses(): Promise<CourseSummary[]> {
  const { data } = await client.get('/teacher/courses');
  return (data.data ?? data ?? []) as CourseSummary[];
}

export async function getCourseDetail(id: string | number): Promise<CourseDetail> {
  const { data } = await client.get(`/teacher/courses/${id}`);
  return (data.data ?? data) as CourseDetail;
}

export async function updateCourseSettings(id: string | number, payload: CourseSettingsPayload): Promise<CourseDetail> {
  const { data } = await client.patch(`/teacher/courses/${id}`, payload);
  return (data.data ?? data) as CourseDetail;
}

export async function updateCourseLocation(id: string | number, payload: LocationPayload): Promise<CourseDetail> {
  const { data } = await client.post(`/teacher/courses/${id}/location`, payload);
  return (data.data ?? data) as CourseDetail;
}

export async function removeCourseSchedule(courseId: string | number, scheduleId: string | number): Promise<CourseDetail> {
  const { data } = await client.delete(`/teacher/courses/${courseId}/schedules/${scheduleId}`);
  return (data.data ?? data) as CourseDetail;
}

/**
 * HARD-delete a whole course (schedule master) — schedules, sessions, history, everything.
 * Server blocks it (422 COURSE_HAS_STUDENTS) while the course still has active students;
 * transfer/terminate them first. Irreversible.
 */
export async function deleteCourse(courseId: string | number): Promise<void> {
  await client.delete(`/teacher/courses/${courseId}`);
}
