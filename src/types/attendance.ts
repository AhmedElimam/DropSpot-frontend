export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type CheckInMethod = 'gps' | 'manual';

export interface AttendanceRecord {
  id: number;
  session_instance_id: number;
  student_id: number;
  status: AttendanceStatus;
  check_in_method: CheckInMethod | null;
  checked_in_at: string | null;
  latitude: number | null;
  longitude: number | null;
  course_name?: string;
  session_time?: string;
  teacher_name?: string;
  teacher_id?: number | null;
  location?: string | null;
}

export interface AbsenceExcuse {
  id: number;
  attendance_record_id: number;
  submitted_by: number;
  reason: string;
  attachment_path: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: number | null;
  reviewed_at: string | null;
}
