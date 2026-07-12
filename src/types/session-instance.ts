export interface SessionInstance {
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
  phone_checkin_allowed?: boolean;
  checkin_permission_expires_at?: string | null;
  teacher_name?: string;
  grade_name?: string;
  enrolled_count?: number;
  present_count?: number;
  absent_count?: number;
  late_count?: number;
}
