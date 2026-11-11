import { applyPendingHomework, homeworkGradeUrls, withHomeworkRating, withHomeworkRatingAll } from '../homeworkGrades';
import type { SessionDetail, SessionAttendee } from '@/api/teacherSessions';

const row = (student_id: number, status: string, homework_rating: SessionAttendee['homework_rating'] = null): SessionAttendee => ({
  student_id, name: `s${student_id}`, student_code: null, card_less: false, status, method: null, checked_in_at: null,
  mark: null, sheet_marked: false, sheet_awaited: false, note: null, homework_rating,
});

const sheet = (attendees: SessionAttendee[], extra: Partial<SessionDetail> = {}): SessionDetail => ({
  id: '7', course_id: 1, course_name: 'فيزياء', scheduled_at: null, date: null, time: null, location: null, status: 'completed',
  present_count: 0, total_count: attendees.length, is_cancelled: false, is_completed: true, is_past: true,
  sheet_expected: false, sheet_excluded: false, sheet_max_mark: null, attendees,
  homework_due: {
    id: 9, body: 'ص ٤٠', session_id: '6', session_date: '2026-10-27',
    counts: {
      good: attendees.filter((a) => a.homework_rating === 'good').length,
      acceptable: attendees.filter((a) => a.homework_rating === 'acceptable').length,
      weak: attendees.filter((a) => a.homework_rating === 'weak').length,
      missing: attendees.filter((a) => a.homework_rating === 'missing').length,
      ungraded: attendees.filter((a) => !a.homework_rating).length,
    },
  },
  can_edit_homework: true,
  ...extra,
});

describe('homework grades over a sheet', () => {
  it('moves one student and the counts with them, and clears back to ungraded', () => {
    const d = withHomeworkRating(sheet([row(1, 'present'), row(2, 'present', 'good')]), 1, 'weak');
    expect(d.attendees[0].homework_rating).toBe('weak');
    expect(d.homework_due!.counts).toEqual({ good: 1, acceptable: 0, weak: 1, missing: 0, ungraded: 0 });
    const cleared = withHomeworkRating(d, 2, null);
    expect(cleared.homework_due!.counts).toEqual({ good: 0, acceptable: 0, weak: 1, missing: 0, ungraded: 1 });
  });

  it('«الكل جيد» fills only the ungraded who came (everyone in a lesson with no attendance)', () => {
    const d = withHomeworkRatingAll(sheet([row(1, 'present'), row(2, 'absent'), row(3, 'late', 'acceptable')]), 'good');
    expect(d.attendees.map((a) => a.homework_rating)).toEqual(['good', null, 'acceptable']);
    const noDoor = withHomeworkRatingAll(sheet([row(1, 'not_recorded'), row(2, 'not_recorded')], { tracks_attendance: false }), 'good');
    expect(noDoor.attendees.every((a) => a.homework_rating === 'good')).toBe(true);
  });

  it('lays the parked grades over the sheet in order — the last tap wins', () => {
    const [one, all] = homeworkGradeUrls(7);
    const d = applyPendingHomework(sheet([row(1, 'present'), row(2, 'present'), row(3, 'present')]), [
      { url: one, body: JSON.stringify({ student_id: 1, rating: 'missing' }) },
      { url: all, body: JSON.stringify({ rating: 'good' }) },
      { url: one, body: JSON.stringify({ student_id: 1, rating: null }) },
      { url: one, body: JSON.stringify({ student_id: 3, rating: 'weak' }) },
      { url: one, body: 'not json' },
    ]);
    expect(d.attendees.map((a) => a.homework_rating)).toEqual([null, 'good', 'weak']);
    expect(d.homework_due!.counts).toEqual({ good: 1, acceptable: 0, weak: 1, missing: 0, ungraded: 1 });
  });

  it('reads a grade parked before the update (done / partial) as good / acceptable', () => {
    const [one, all] = homeworkGradeUrls(7);
    const d = applyPendingHomework(sheet([row(1, 'present'), row(2, 'present'), row(3, 'present')]), [
      { url: one, body: JSON.stringify({ student_id: 1, rating: 'partial' }) },
      { url: one, body: JSON.stringify({ student_id: 2, rating: 'bogus' }) },
      { url: all, body: JSON.stringify({ rating: 'done' }) },
    ]);
    expect(d.attendees.map((a) => a.homework_rating)).toEqual(['acceptable', 'good', 'good']);
  });
});
