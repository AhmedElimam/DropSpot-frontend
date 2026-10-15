import { countdown, nextExam, revisionFacts, revisionToCard, revisionsOnDay, sortForSeason } from '../revisionDesk';
import type { RevisionSummary } from '@/api/revisions';

const H = 60 * 60_000;
const D = 24 * H;
// A fixed local «now»: Friday 2026-10-16 10:00 local time.
const now = new Date(2026, 9, 16, 10, 0).getTime();
const iso = (t: number) => new Date(t).toISOString();

const rev = (id: number, at: number | null, exam = false): RevisionSummary => ({
  id, title: `R${id}`, billing_mode: 'free', purpose: exam ? 'quiz_exam' : 'revision', is_quiz_exam: exam, max_mark: exam ? 50 : null,
  instance_id: at === null ? null : id * 10, scheduled_at: at === null ? null : iso(at),
});

describe('nextExam', () => {
  it('prefers the soonest exam ahead, over a sooner revision', () => {
    const list = [rev(1, now + 1 * H), rev(2, now + 3 * D, true), rev(3, now + 1 * D, true)];
    expect(nextExam(list, now)?.rev.id).toBe(3);
    expect(nextExam(list, now)?.kind).toBe('exam');
  });
  it('falls back to the next revision session when no exam is ahead', () => {
    const list = [rev(1, now + 5 * H), rev(2, now - 2 * D, true), rev(3, now + 2 * H)];
    expect(nextExam(list, now)?.rev.id).toBe(3);
    expect(nextExam(list, now)?.kind).toBe('revision');
  });
  it('an exam that started an hour ago is still «now»; one from yesterday is not', () => {
    expect(nextExam([rev(1, now - 1 * H, true)], now)?.rev.id).toBe(1);
    expect(nextExam([rev(1, now - 1 * D, true)], now)).toBeNull();
  });
  it('ignores sessions with no slot', () => {
    expect(nextExam([rev(1, null, true)], now)).toBeNull();
  });
});

describe('countdown', () => {
  it('picks the coarsest non-zero unit', () => {
    expect(countdown(now + 3 * D + 5 * H, now)).toMatchObject({ key: 'revision.in_days', n: 3 });
    expect(countdown(now + 5 * H + 20 * 60_000, now)).toMatchObject({ key: 'revision.in_hours', n: 5 });
    expect(countdown(now + 20 * 60_000, now)).toMatchObject({ key: 'revision.in_minutes', n: 20 });
  });
  it('is «now» at and past the moment', () => {
    expect(countdown(now, now).key).toBe('revision.now');
    expect(countdown(now - 1, now).key).toBe('revision.now');
    expect(countdown(now + 30_000, now).key).toBe('revision.now');
  });
});

describe('revisionsOnDay', () => {
  it('keeps only the local day, soonest first', () => {
    const list = [rev(1, now + 6 * H), rev(2, now + 1 * D), rev(3, now + 2 * H), rev(4, null)];
    expect(revisionsOnDay(list, '2026-10-16').map((r) => r.id)).toEqual([3, 1]);
  });
});

describe('revisionFacts', () => {
  it('counts the Saturday–Friday week and what lies ahead', () => {
    // Friday: this week runs Sat 10 → Fri 16.
    const list = [rev(1, now + 6 * H), rev(2, now - 3 * D), rev(3, now + 2 * D, true), rev(4, now - 10 * D, true)];
    expect(revisionFacts(list, now)).toEqual({ thisWeek: 2, examsAhead: 1, sessionsAhead: 1 });
  });
});

describe('sortForSeason', () => {
  const rows = [
    { id: 'a', type: 'normal_sheet' as const },
    { id: 'b', is_exam: true },
    { id: 'c', kind: 'revision' as const },
    { id: 'd' },
    { id: 'e', type: 'quiz_exam' as const },
  ];
  it('is the identity while the season is off', () => {
    expect(sortForSeason(rows, false).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('puts exams, then revisions, first — stably — while on', () => {
    expect(sortForSeason(rows, true).map((r) => r.id)).toEqual(['b', 'e', 'c', 'a', 'd']);
  });
});

describe('revisionToCard', () => {
  it('turns a revision into a session card that knows what it is', () => {
    const card = revisionToCard(rev(7, now + 2 * H, true));
    expect(card).toMatchObject({ id: 'revision-7', kind: 'exam', revision_id: 7, instance_id: 70, course_name: 'R7', status: 'scheduled', max_mark: 50 });
    expect(card.time).toBeTruthy();
  });
});
