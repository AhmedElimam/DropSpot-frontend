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
  qr_token: string | null;
  course_name?: string;
  teacher_name?: string;
  grade_name?: string;
  enrolled_count?: number;
  present_count?: number;
  absent_count?: number;
  late_count?: number;
}
