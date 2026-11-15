import type { CourseSummary } from '@/api/courses';
import { searchScore } from './smartSearch';

/**
 * «المقررات» search (founder 2026-11-15: «a smart search on the all courses page»). The students
 * tab's matcher (src/utils/smartSearch.ts: hamza / ة / ى folding, Arabic digits, any word order),
 * over everything a course row shows: its name, its grade, its weekly days and times, its period
 * and its kind. The server writes times as «9:00 AM»; they are matched as «9:00 ص» too, so «٤ م»
 * or «السبت ٤» find a Saturday 4 PM course.
 */
export type CourseSearchWords = { private: string; hidden: string; noLocation: string };

export function arabicTimes(label: string | null | undefined): string {
  return (label ?? '').replace(/\bAM\b/gi, 'ص').replace(/\bPM\b/gi, 'م');
}

export function courseSearchScore(c: CourseSummary, query: string, words: CourseSearchWords): number {
  const noDoor = c.tracks_attendance === false;
  return searchScore({
    name: c.name,
    tags: [
      c.grade_name,
      c.schedule_label,
      arabicTimes(c.schedule_label),
      c.shift_label,
      c.attendance_label,
      noDoor ? words.private : null,
      c.hidden_from_assistants ? words.hidden : null,
      !noDoor && !c.phone_checkin_active ? words.noLocation : null,
    ],
  }, query);
}
