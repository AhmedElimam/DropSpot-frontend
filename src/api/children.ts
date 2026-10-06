import client from './client';
import { extractList, extractAttrs } from './utils';

export interface Child {
  id: string;
  name: string;
  grade: string | null;
  grade_id: number | null;
  student_code: string | null;
  has_card?: boolean;
  can_generate_pre_card?: boolean;
  attendance_rate: number;
  date_of_birth: string | null;
  student_id: number;
  user_id: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  teachers: {
    id: string; name: string; phone?: string | null; logo_url?: string | null; is_distinguished_member?: boolean;
    /** What the child takes with this teacher: the course and its weekly slot (2026-10-06). */
    courses?: { name: string | null; day: string | null; time: string | null }[];
    /** How the child attends this teacher's sessions: recorded, present/late, absent. */
    attendance?: { held: number; attended: number; absent: number };
  }[];
}

export async function getChildren(): Promise<Child[]> {
  const { data } = await client.get('/parents/children');
  return extractList(data, 'children').map((item: any) => {
    const attrs = extractAttrs(item);
    return { id: item.id, ...attrs };
  });
}
