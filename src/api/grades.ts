import client from './client';
import { extractList, extractAttrs } from './utils';
import type { GradeRecord } from '@/types/grade-record';

export async function getStudentGrades(studentId: number): Promise<GradeRecord[]> {
  const { data } = await client.get(`/students/${studentId}/grades`);
  return extractList(data, 'grades').map((item: any) => {
    const attrs = extractAttrs(item);
    return { id: parseInt(item.id, 10), ...attrs };
  });
}
