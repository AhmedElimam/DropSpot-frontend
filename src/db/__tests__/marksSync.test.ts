import { applyPendingMarks, applyMarkResults, isNetworkFailure } from '../marksSync';
import type { OfflineMark } from '../offlineMarks';
import type { SessionDetail, SessionAttendee } from '@/api/teacherSessions';

function attendee(id: number, status = 'not_recorded'): SessionAttendee {
  return { student_id: id, name: `S${id}`, student_code: `C${id}`, card_less: false, status, method: null, checked_in_at: null, mark: null, sheet_marked: false, sheet_awaited: false, note: null };
}
function detail(attendees: SessionAttendee[]): SessionDetail {
  return {
    id: '7', course_id: 1, course_name: 'C', scheduled_at: null, date: null, time: null, location: null, status: 'scheduled',
    present_count: attendees.filter((a) => a.status === 'present' || a.status === 'late').length, total_count: attendees.length,
    is_cancelled: false, is_completed: false, is_past: false, sheet_expected: true, sheet_excluded: false, sheet_max_mark: null, attendees,
  };
}
function mark(id: number, student: number, status: OfflineMark['status'], uuid = `u${id}`): OfflineMark {
  return { id, client_uuid: uuid, session_instance_id: 7, student_id: student, status, marked_at: '2026-10-02T10:00:00Z', teacher_id: 1, student_name: null, course_name: null, last_error: null, state: 'pending' };
}

describe('applyPendingMarks — the roster shows what the teacher tapped until the sync confirms it', () => {
  it('overlays queued statuses, flags them pending, and recounts present', () => {
    const d = detail([attendee(1), attendee(2, 'absent'), attendee(3, 'present')]);
    const out = applyPendingMarks(d, [mark(1, 1, 'present'), mark(2, 3, 'absent')]);
    expect(out.attendees[0]).toMatchObject({ status: 'present', pending_sync: true, method: 'manual' });
    expect(out.attendees[1]).toMatchObject({ status: 'absent' });
    expect(out.attendees[1].pending_sync).toBeUndefined();
    expect(out.attendees[2]).toMatchObject({ status: 'absent', pending_sync: true });
    expect(out.present_count).toBe(1);
  });

  it('returns the same object when nothing is queued', () => {
    const d = detail([attendee(1)]);
    expect(applyPendingMarks(d, [])).toBe(d);
  });
});

describe('applyMarkResults — per-row verdicts', () => {
  const rows = [mark(10, 1, 'present'), mark(11, 2, 'absent'), mark(12, 3, 'late'), mark(13, 4, 'excused')];

  it('drops synced / already_applied / stale and parks failed', () => {
    const r = applyMarkResults(rows, [
      { client_uuid: 'u10', student_id: 1, session_instance_id: 7, outcome: 'synced', code: null, message: null },
      { client_uuid: 'u11', student_id: 2, session_instance_id: 7, outcome: 'already_applied', code: 'ALREADY_APPLIED', message: null },
      { client_uuid: 'u12', student_id: 3, session_instance_id: 7, outcome: 'stale', code: 'STALE', message: 'newer' },
      { client_uuid: 'u13', student_id: 4, session_instance_id: 7, outcome: 'failed', code: 'NOT_ENROLLED', message: 'غير مسجل' },
      { client_uuid: 'unknown', student_id: 9, session_instance_id: 7, outcome: 'synced', code: null, message: null },
    ]);
    expect(r.toDelete.sort()).toEqual([10, 11, 12]);
    expect(r.toReject).toEqual([{ id: 13, error: 'غير مسجل' }]);
    expect(r.synced).toBe(1);
    expect(r.staleSessionIds).toEqual([7]);
  });
});

describe('isNetworkFailure — a server verdict is never mistaken for a dropout', () => {
  it('is true for an error with no response, false when the server answered', () => {
    expect(isNetworkFailure({ message: 'Network Error' })).toBe(true);
    expect(isNetworkFailure({ response: { status: 422, data: {} } })).toBe(false);
    expect(isNetworkFailure(null)).toBe(false);
  });
});
