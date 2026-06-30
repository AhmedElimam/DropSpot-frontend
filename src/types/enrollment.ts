import type { Course } from './course';
import type { User } from './user';

export interface Enrollment {
  id: number;
  student_id: number;
  course_id: number;
  teacher_id: number;
  academic_session_id: number;
  status: 'active' | 'completed' | 'dropped';
  enrolled_at: string;
  course?: Course;
  teacher?: User;
}
