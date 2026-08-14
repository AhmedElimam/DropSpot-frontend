import client from './client';

/**
 * Teacher schedule tools — parity with web /schedule-merges and /schedule-overrides.
 * Merge two same-grade slots into one; set temporary (Ramadan) time overrides that
 * auto-revert. Overrides are gated by the ramadan_schedule feature flag server-side.
 */

// ---- Merge ----

export interface MergeSlot {
  id: string;
  grade_id: number;
  course_name: string | null;
  label: string;
  headcount: number;
}

export interface MergeCustomSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface MergeResult {
  moved: number;
  warnings: string[];
}

export async function getMergeOptions(): Promise<MergeSlot[]> {
  const { data } = await client.get('/teacher/schedule-merges/options');
  return ((data.data ?? data)?.schedules ?? []) as MergeSlot[];
}

export async function mergeSchedules(payload: {
  survivor_id: number;
  retiring_id: number;
  time_choice: 'survivor' | 'retiring' | 'custom';
  slots?: MergeCustomSlot[];
}): Promise<MergeResult> {
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
