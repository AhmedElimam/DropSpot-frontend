import { latestNotes } from '../notes';
import type { SessionNoteEntry } from '@/api/sessionNotes';

const entry = (id: string, written_at: string | null): SessionNoteEntry => ({
  id, session_instance_id: id, student_id: '1', student_name: 'يوسف', course_name: 'فيزياء', teacher_name: 'سامي',
  scheduled_at: written_at, status: 'present', summary: 'شرحنا', note: null, written_at,
});

describe('latestNotes', () => {
  const now = new Date('2026-10-22T10:00:00Z');

  it('keeps the newest three, counts the last 48 hours, and names the newest', () => {
    const r = latestNotes([entry('a', '2026-10-15T10:00:00Z'), entry('b', '2026-10-21T10:00:00Z'), entry('c', '2026-10-22T09:00:00Z'), entry('d', '2026-10-18T10:00:00Z')], now);
    expect(r.top.map((e) => e.id)).toEqual(['c', 'b', 'd']);
    expect(r.fresh).toBe(2);
    expect(r.latest?.written_at).toBe('2026-10-22T09:00:00Z');
  });

  it('nothing written: nothing to say', () => {
    expect(latestNotes([], now)).toEqual({ top: [], fresh: 0, latest: null });
  });
});
