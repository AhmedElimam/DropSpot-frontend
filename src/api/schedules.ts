import client from './client';

/**
 * Teacher/assistant schedule creation — adds a weekly slot to an EXISTING course.
 * Gated server-side by `assistant.can:manage_sessions` (teachers always pass; an
 * assistant needs the ability on their active teacher context). Course creation
 * itself stays on the web dashboard.
 */
export interface CreateSchedulePayload {
  course_id: number;
  day_of_week: number; // 0 = Sunday … 6 = Saturday
  start_time: string; // HH:mm (24h)
  end_time: string; // HH:mm (24h)
  capacity?: number | null;
}

export interface CreatedSchedule {
  id: string;
  course_id: number;
  course_name: string | null;
  day_of_week: number;
  day_label: string;
  start_time: string;
  end_time: string;
  capacity: number | null;
  generated: number;
  /** Non-null when the new slot overlaps another of the teacher's slots — a warning, not a block. */
  warning: string | null;
}

export async function createSchedule(payload: CreateSchedulePayload): Promise<CreatedSchedule> {
  const { data } = await client.post('/teacher/schedules', payload);
  // Flat object under `data` (not JSON:API-wrapped) — read it directly.
  return data.data ?? data;
}
