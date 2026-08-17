import client from './client';
import type { ExamResult } from './reports';

/**
 * A student's PHYSICAL exam results (نتيجة الامتحان) — single-session + merged (revision)
 * big-exam marks. Separate from digital quizzes and from the sheet-mark average.
 */
export async function getStudentExamResults(studentId: number): Promise<ExamResult[]> {
  const { data } = await client.get(`/students/${studentId}/exam-results`);
  return (data.data ?? data ?? []) as ExamResult[];
}
