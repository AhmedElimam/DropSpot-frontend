import type { User } from './user';
import type { Grade } from './grade';

export interface Student {
  id: number;
  user_id: number;
  grade_id: number;
  student_code: string;
  date_of_birth: string | null;
  profile_meta: Record<string, unknown> | null;
  user?: User;
  grade?: Grade;
}

export interface StudentParent {
  id: number;
  student_id: number;
  parent_id: number;
  relationship: 'father' | 'mother' | 'guardian';
  is_primary: boolean;
  receives_notifications: boolean;
  student?: Student;
}
