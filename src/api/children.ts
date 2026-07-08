import client from './client';
import { extractList, extractAttrs } from './utils';

export interface Child {
  id: string;
  name: string;
  grade: string | null;
  grade_id: number | null;
  student_code: string | null;
  attendance_rate: number;
  date_of_birth: string | null;
  student_id: number;
  user_id: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  teachers: { id: string; name: string; phone?: string | null }[];
}

export async function getChildren(): Promise<Child[]> {
  const { data } = await client.get('/parents/children');
  return extractList(data, 'children').map((item: any) => {
    const attrs = extractAttrs(item);
    return { id: item.id, ...attrs };
  });
}
