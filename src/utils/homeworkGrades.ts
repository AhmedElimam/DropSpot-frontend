import type { SessionDetail } from '@/api/teacherSessions';
import { normalizeRating, type HomeworkRating } from '@/api/homework';

/**
 * Homework grades laid over a session sheet before the server confirms them: at the tap,
 * and — while they wait in the outbox with no connection — every time the sheet is read,
 * so what the teacher graded is what the teacher sees until the replay lands.
 */

/** One student's grade, the due card's counts moved with it. */
export function withHomeworkRating(d: SessionDetail, studentId: number, rating: HomeworkRating | null): SessionDetail {
  const row = d.attendees.find((a) => a.student_id === studentId);
  if (!row || !d.homework_due) return d;
  const was = row.homework_rating ?? null;
  if (was === rating) return d;
  const counts = { ...d.homework_due.counts };
  counts[was ?? 'ungraded'] = Math.max(0, (counts[was ?? 'ungraded'] ?? 0) - 1);
  counts[rating ?? 'ungraded'] = (counts[rating ?? 'ungraded'] ?? 0) + 1;
  return {
    ...d,
    attendees: d.attendees.map((a) => (a.student_id === studentId ? { ...a, homework_rating: rating } : a)),
    homework_due: { ...d.homework_due, counts },
  };
}

/** «الكل جيد»: every still-ungraded roster student who came (everyone, when the course takes no attendance). */
export function withHomeworkRatingAll(d: SessionDetail, rating: HomeworkRating): SessionDetail {
  if (!d.homework_due) return d;
  const noDoor = d.tracks_attendance === false;
  let out = d;
  for (const a of d.attendees) {
    const came = noDoor || a.status === 'present' || a.status === 'late';
    if (came && (a.homework_rating ?? null) === null) out = withHomeworkRating(out, a.student_id, rating);
  }
  return out;
}

/**
 * The session's grades still waiting in the outbox, oldest first — replayed in that order, so
 * the last one wins. One parked before the quality grades says done / partial: read as
 * good / acceptable, as the server stores it.
 */
export function applyPendingHomework(d: SessionDetail, pending: { url: string; body: string | null }[]): SessionDetail {
  let out = d;
  for (const p of pending) {
    let body: { student_id?: unknown; rating?: unknown } = {};
    try { body = p.body ? JSON.parse(p.body) : {}; } catch { continue; }
    const rating = normalizeRating(body.rating);
    if (/\/homework-rate-all$/.test(p.url)) {
      if (rating) out = withHomeworkRatingAll(out, rating);
    } else if (/\/homework-rate$/.test(p.url) && body.student_id != null) {
      out = withHomeworkRating(out, Number(body.student_id), rating);
    }
  }
  return out;
}

/** The outbox urls of a session's homework grades (as the API module sends them). */
export function homeworkGradeUrls(sessionId: string | number): string[] {
  return [`/teacher/sessions/${sessionId}/homework-rate`, `/teacher/sessions/${sessionId}/homework-rate-all`];
}
