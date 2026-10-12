/**
 * The private-lesson contract (founder 2026-10-12): a course with `attendance_mode: 'none'`
 * takes NO attendance — no scan, no check-in, no absences, no excuses, no swaps; schedule,
 * money and marks only. The server stamps these on every course-ish and session payload.
 * A MISSING field means a door course (the default), so older responses keep working.
 */
export interface AttendanceModeFields {
  attendance_mode?: 'door' | 'none' | null;
  tracks_attendance?: boolean | null;
  /** The server's own words for the mode (e.g. «درس خصوصي · بدون تسجيل حضور»); drawn verbatim when present. */
  attendance_label?: string | null;
}
