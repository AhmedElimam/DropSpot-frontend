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
      done: attendees.filter((a) => a.homework_rating === 'done').length,
      partial: attendees.filter((a) => a.homework_rating === 'partial').length,
      missing: attendees.filter((a) => a.homework_rating === 'missing').length,
      ungraded: attendees.filter((a) => !a.homework_rating).length,
    },
  },
  can_edit_homework: true,
  ...extra,
});

describe('homework grades over a sheet', () => {
  it('moves one student and the counts with them, and clears back to ungraded', () => {
    const d = withHomeworkRating(sheet([row(1, 'present'), row(2, 'present', 'done')]), 1, 'missing');
    expect(d.attendees[0].homework_rating).toBe('missing');
    expect(d.homework_due!.counts).toEqual({ done: 1, partial: 0, missing: 1, ungraded: 0 });
    const cleared = withHomeworkRating(d, 2, null);
    expect(cleared.homework_due!.counts).toEqual({ done: 0, partial: 0, missing: 1, ungraded: 1 });
  });

  it('«الكل حلّ» fills only the ungraded who came (everyone in a lesson with no attendance)', () => {
    const d = withHomeworkRatingAll(sheet([row(1, 'present'), row(2, 'absent'), row(3, 'late', 'partial')]), 'done');
    expect(d.attendees.map((a) => a.homework_rating)).toEqual(['done', null, 'partial']);
    const noDoor = withHomeworkRatingAll(sheet([row(1, 'not_recorded'), row(2, 'not_recorded')], { tracks_attendance: false }), 'done');
    expect(noDoor.attendees.every((a) => a.homework_rating === 'done')).toBe(true);
  });

  it('lays the parked grades over the sheet in order — the last tap wins', () => {
    const [one, all] = homeworkGradeUrls(7);
    const d = applyPendingHomework(sheet([row(1, 'present'), row(2, 'present')]), [
      { url: one, body: JSON.stringify({ student_id: 1, rating: 'missing' }) },
      { url: all, body: JSON.stringify({ rating: 'done' }) },
      { url: one, body: JSON.stringify({ student_id: 1, rating: null }) },
      { url: one, body: 'not json' },
    ]);
    expect(d.attendees.map((a) => a.homework_rating)).toEqual([null, 'done']);
    expect(d.homework_due!.counts).toEqual({ done: 1, partial: 0, missing: 0, ungraded: 1 });
  });
});
