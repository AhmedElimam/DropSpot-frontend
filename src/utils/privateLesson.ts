import type { AttendanceModeFields } from '@/types/attendance-mode';

/**
 * Does this course / session / record / standing take attendance? True unless the server
 * said otherwise: `tracks_attendance` wins when present, else `attendance_mode: 'none'`
 * means a private lesson. Anything without the fields is a door course (older payloads).
 */
export function tracksAttendance(x: AttendanceModeFields | null | undefined): boolean {
  if (!x) return true;
  if (typeof x.tracks_attendance === 'boolean') return x.tracks_attendance;
  return x.attendance_mode !== 'none';
}

/** A private lesson: schedule, money and marks only — nothing attendance-shaped is drawn for it. */
export function isPrivateLesson(x: AttendanceModeFields | null | undefined): boolean {
  return !tracksAttendance(x);
}

/** The words to draw for a private lesson: the server's label when it sent one, else the app's. */
export function attendanceLabel(x: AttendanceModeFields | null | undefined, fallback: string): string {
  const label = x?.attendance_label?.trim();
  return label ? label : fallback;
}
