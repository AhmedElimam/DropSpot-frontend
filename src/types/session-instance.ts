import type { AttendanceModeFields } from './attendance-mode';

export interface SessionInstance extends AttendanceModeFields {
  id: number;
  session_schedule_id: number;
  scheduled_at: string;
  actual_at: string | null;
  duration_minutes: number;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  location: string | null;
  is_override: boolean;
  override_reason: string | null;
  course_name?: string;
  course_latitude?: number | null;
  course_longitude?: number | null;
  radius_horizontal_meters?: number;
  // The anchor's setup uncertainty — folded into the client geofence exactly as
  // the server does, so the client is never stricter than the server.
  location_accuracy_meters?: number | null;
  phone_checkin_allowed?: boolean;
  checkin_permission_expires_at?: string | null;
  /** The student's OWN outcome for this session (present/late/absent/excused), once
   *  recorded. Null while the session is still upcoming/unmarked. */
  attendance_status?: 'present' | 'late' | 'absent' | 'excused' | null;
  checked_in?: boolean;
  can_check_in?: boolean;
  teacher_name?: string;
  grade_name?: string;
  enrolled_count?: number;
  present_count?: number;
  absent_count?: number;
  late_count?: number;
  /** «واجب الحصة» (2026-11-11): the group's last session's homework, due at this one; `rating` once graded. */
  homework_due?: { body: string; assigned_on: string | null; rating: string | null } | null;
  /** «حصة أونلاين»: the class is on air (today / upcoming rows). Absent/null = the feature is off for that teacher. */
  remote?: { live: boolean } | null;
  /** «حضوري / أونلاين»: how the session is held, said in advance. Absent on older servers = in person. */
  delivery?: 'in_person' | 'remote';
}
