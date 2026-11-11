import client from './client';

/**
 * «الواجب» (founder 2026-11-03): the teacher gives homework at a session; at the group's next
 * session each student is graded like a quiz — جيد / مقبول / ضعيف / لم يحلّ. null = not graded yet.
 */
export type HomeworkRating = 'good' | 'acceptable' | 'weak' | 'missing';
export const HOMEWORK_RATINGS: readonly HomeworkRating[] = ['good', 'acceptable', 'weak', 'missing'];

/**
 * A grade as stored anywhere: the first build's names (done / partial — an old answer, or a
 * grade parked in the outbox before the update) read as good / acceptable. Anything else: none.
 */
export function normalizeRating(x: unknown): HomeworkRating | null {
  if (x === 'done') return 'good';
  if (x === 'partial') return 'acceptable';
  return typeof x === 'string' && (HOMEWORK_RATINGS as readonly string[]).includes(x) ? (x as HomeworkRating) : null;
}

/** Over every graded homework; the server's `rate` counts good 1, acceptable ½, weak and missing 0 — null when nothing graded. */
export interface HomeworkSummary {
  good: number;
  acceptable: number;
  weak: number;
  missing: number;
  graded: number;
  rate: number | null;
}

/** One homework for one child (`id` = "homeworkId:studentId"). Dates are YYYY-MM-DD. */
export interface HomeworkEntry {
  id: string;
  homework_id: string;
  student_id: string;
  student_name: string | null;
  course_name: string | null;
  teacher_name: string | null;
  assigned_on: string | null;
  body: string;
  rating: HomeworkRating | null;
  graded_on: string | null;
}

export interface HomeworkPage {
  items: HomeworkEntry[];
  summary: HomeworkSummary | null;
  meta: { current_page: number; last_page: number; total: number };
}

function page(data: any): HomeworkPage {
  return {
    items: (data?.data ?? []) as HomeworkEntry[],
    summary: (data?.summary ?? null) as HomeworkSummary | null,
    meta: data?.meta ?? { current_page: 1, last_page: 1, total: 0 },
  };
}

/** A parent: one child, or every child when `studentId` is omitted. */
export async function getFamilyHomework(p: { studentId?: string | null; page?: number }): Promise<HomeworkPage> {
  const { data } = await client.get('/parents/homework', {
    params: { page: p.page ?? 1, ...(p.studentId ? { student_id: p.studentId } : {}) },
  });
  return page(data);
}

/** A student: their own. */
export async function getMyHomework(p: { page?: number }): Promise<HomeworkPage> {
  const { data } = await client.get('/students/homework', { params: { page: p.page ?? 1 } });
  return page(data);
}

/** A date-only YYYY-MM-DD read at local noon, so no timezone shifts it to the day before. */
export function homeworkDay(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date;
}
