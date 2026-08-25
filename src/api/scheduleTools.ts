import client from './client';

/**
 * Teacher schedule tools — parity with web /schedule-merges and /schedule-overrides.
 * Merge two same-grade slots into one; set temporary (Ramadan) time overrides that
 * auto-revert. Overrides are gated by the ramadan_schedule feature flag server-side.
 */

// ---- Merge (COURSE-level / schedule-master) ----

export interface MergeCourse {
  id: string;
  grade_id: number;
  course_name: string | null;
  /** The weekdays the course meets, e.g. "الأحد • الأربعاء". */
  slots_label: string | null;
  headcount: number;
}

export interface MergeResult {
  moved: number;
  terminated: number;
  warnings: string[];
}

export async function getMergeOptions(): Promise<MergeCourse[]> {
  const { data } = await client.get('/teacher/schedule-merges/options');
  return ((data.data ?? data)?.courses ?? []) as MergeCourse[];
}

export interface NewCourseSlot {
  day_of_week: number; // 0=Sunday … 6=Saturday
  start_time: string;  // HH:mm
  end_time: string;    // HH:mm
}

/**
 * Merge sources INTO an existing destination course, OR into a BRAND-NEW course created
 * on the spot with teacher-defined weekly slots (new_course_*). Sources that aren't the
 * destination are terminated.
 */
export type MergePayload =
  | { destination_course_id: number; source_course_ids: number[] }
  | { new_course_name: string; new_course_slots: NewCourseSlot[]; source_course_ids: number[] };

export async function mergeCourses(payload: MergePayload): Promise<MergeResult> {
  const { data } = await client.post('/teacher/schedule-merges', payload);
  return (data.data ?? data) as MergeResult;
}

// ---- Ramadan overrides ----

export interface OverrideSlotOption {
  id: string;
  label: string;
  start_time: string;
}

export interface OverrideCourseGroup {
  course_name: string | null;
  schedules: OverrideSlotOption[];
}

export interface ActiveOverride {
  id: string;
  label: string;
  course_name: string | null;
  slot_label: string | null;
  new_time: string;
  start_date: string | null;
  end_date: string | null;
}

export interface OverrideOptions {
  courses: OverrideCourseGroup[];
  active: ActiveOverride[];
  suggested: { start: string; end: string; eid: string };
}

export async function getOverrideOptions(): Promise<OverrideOptions> {
  const { data } = await client.get('/teacher/schedule-overrides');
  return (data.data ?? data) as OverrideOptions;
}

export async function createOverride(payload: {
  label?: string;
  start_date: string;
  end_date: string;
  items: { schedule_id: number; start_time: string }[];
}): Promise<{ created: number }> {
  const { data } = await client.post('/teacher/schedule-overrides', payload);
  return (data.data ?? data) as { created: number };
}

export async function cancelOverride(id: string | number): Promise<void> {
  await client.delete(`/teacher/schedule-overrides/${id}`);
}
