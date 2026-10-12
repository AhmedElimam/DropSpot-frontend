import type { AttendanceModeFields } from './attendance-mode';

/** `attendance_mode: 'none'` = a private lesson (no attendance at all); missing = door course. */
export interface Course extends AttendanceModeFields {
  id: number;
  grade_id: number;
  academic_session_id: number;
  name: string;
  code: string;
  description: string | null;
}
