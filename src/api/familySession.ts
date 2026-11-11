import client from './client';
import type { AttendanceModeFields } from '@/types/attendance-mode';
import { normalizeRating, type HomeworkRating } from './homework';

/**
 * One session as a family reads it (founder 2026-11-10: «a session details modal on the student
 * and parent side to show every single thing»): attendance, the sheet mark, the teacher's note
 * to the session, the note about the child, the homework given there and the one graded there.
 */
export interface FamilySessionDetail extends AttendanceModeFields {
  id: string;
  student_id: string;
  student_name: string | null;
  course_name: string | null;
  teacher_id: number | null;
  teacher_name: string | null;
  teacher_gender: 'male' | 'female';
  teacher_logo_url: string | null;
  scheduled_at: string | null;
  duration_minutes: number;
  location: string | null;
  type: string;
  session_status: string;
  attendance: {
    status: 'present' | 'late' | 'absent' | 'excused';
    check_in_method: string | null;
    checked_in_at: string | null;
    via_swap: boolean;
    covered_in: { course_name: string | null; scheduled_at: string | null } | null;
    excuse: { reason: string | null; status: string | null } | null;
  } | null;
  mark: { score: number; max: number | null; percentage: number | null; is_exam: boolean; attendance_record_id: number } | null;
  summary: string | null;
  summary_at: string | null;
  note: string | null;
  note_at: string | null;
  homework_given: { body: string; rating: HomeworkRating | null; graded_on: string | null } | null;
  homework_checked: { body: string; assigned_on: string | null; rating: HomeworkRating | null } | null;
}

export async function getFamilySessionDetail(studentId: number, sessionId: number): Promise<FamilySessionDetail> {
  const { data } = await client.get(`/students/${studentId}/sessions/${sessionId}/detail`);
  const d = (data?.data ?? {}) as FamilySessionDetail;
  return {
    ...d,
    homework_given: d.homework_given ? { ...d.homework_given, rating: normalizeRating(d.homework_given.rating) } : null,
    homework_checked: d.homework_checked ? { ...d.homework_checked, rating: normalizeRating(d.homework_checked.rating) } : null,
  };
}

/** What each record row carries about its session (same server source as the sheet). */
export interface SessionRowExtras {
  summary?: string | null;
  note?: string | null;
  homework?: string | null;
  homework_rating?: HomeworkRating | null;
  mark?: number | null;
  max_mark?: number | null;
}
