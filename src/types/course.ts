export interface Course {
  id: number;
  grade_id: number;
  academic_session_id: number;
  name: string;
  code: string;
  description: string | null;
}
