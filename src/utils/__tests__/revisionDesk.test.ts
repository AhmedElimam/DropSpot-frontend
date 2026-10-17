import { arabicCountForm, countdown, countdownBlock, nextExam, nextSlot, revisionFacts, revisionToCard, revisionsOnDay, seasonShareLeft, sortForSeason, splitRevisionTitle } from '../revisionDesk';
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

describe('nextSlot', () => {
  it('is the soonest slot ahead, exam or not — where the kiosk opens', () => {
    const list = [rev(1, now + 1 * D, true), rev(2, now + 2 * H), rev(3, now - 3 * H)];
    expect(nextSlot(list, now)?.rev.id).toBe(2);
    expect(nextSlot([rev(1, now - 1 * H)], now)?.rev.id).toBe(1);
    expect(nextSlot([rev(1, null), rev(2, now - 1 * D)], now)).toBeNull();
  });
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

describe('countdown block (manage card hero)', () => {
  it('days: the number and its Arabic unit form', () => {
    expect(countdownBlock(countdown(now + 3 * 24 * H, now))).toEqual({ n: 3, unitKey: 'revision.unit_days_few' });
    expect(countdownBlock(countdown(now + 1 * 24 * H + H, now))).toEqual({ n: 1, unitKey: 'revision.unit_days_one' });
    expect(countdownBlock(countdown(now + 2 * 24 * H, now))).toEqual({ n: 2, unitKey: 'revision.unit_days_few' }); // «٢ أيام», never «٢ يومان»
    expect(countdownBlock(countdown(now + 14 * 24 * H, now))).toEqual({ n: 14, unitKey: 'revision.unit_days_many' });
  });
  it('hours and minutes under a day', () => {
    expect(countdownBlock(countdown(now + 5 * H + 20 * 60_000, now))).toEqual({ n: 5, unitKey: 'revision.unit_hours_few' });
    expect(countdownBlock(countdown(now + 11 * 60_000, now))).toEqual({ n: 11, unitKey: 'revision.unit_minutes_many' });
  });
  it('now: no number, the word alone', () => {
    expect(countdownBlock(countdown(now - 10 * 60_000, now))).toEqual({ n: null, unitKey: 'revision.now' });
  });
  it('arabicCountForm', () => {
    expect([1, 2, 3, 10, 11, 0, 100].map(arabicCountForm)).toEqual(['one', 'two', 'few', 'few', 'many', 'many', 'many']);
  });
  it('every unit key exists in ar.json', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ar = require('@/i18n/ar.json');
    for (const u of ['days', 'hours', 'minutes']) for (const f of ['one', 'two', 'few', 'many']) expect(typeof ar.revision[`unit_${u}_${f}`]).toBe('string');
  });
});

describe('splitRevisionTitle', () => {
  it('splits the name from the subject at the last dash', () => {
    expect(splitRevisionTitle('امتحان شامل — الفيزياء')).toEqual({ name: 'امتحان شامل', subject: 'الفيزياء' });
    expect(splitRevisionTitle('مراجعة - الباب الأول — الكيمياء')).toEqual({ name: 'مراجعة - الباب الأول', subject: 'الكيمياء' });
  });
  it('no dash: the whole title, no subject', () => {
    expect(splitRevisionTitle('مراجعة ليلة الامتحان')).toEqual({ name: 'مراجعة ليلة الامتحان', subject: null });
    expect(splitRevisionTitle('  ')).toEqual({ name: '', subject: null });
  });
});

describe('seasonShareLeft (Rose look C ring)', () => {
  it('null with nothing ahead', () => {
    expect(seasonShareLeft([], now)).toBeNull();
    expect(seasonShareLeft([rev(1, now - 3 * D, true)], now)).toBeNull();
  });
  it('a lone exam: its distance over a one-week floor', () => {
    expect(seasonShareLeft([rev(1, now + 3.5 * D, true)], now)).toBeCloseTo(0.5, 5);
    expect(seasonShareLeft([rev(1, now + 30 * D, true)], now)).toBe(1);
  });
  it('the span starts at the earliest slot already behind', () => {
    // started 10 days ago, exam in 10 days → half left
    expect(seasonShareLeft([rev(1, now - 10 * D), rev(2, now + 10 * D, true)], now)).toBeCloseTo(0.5, 5);
  });
  it('an exam being sat (inside the grace) is 0, never negative', () => {
    expect(seasonShareLeft([rev(1, now - H, true)], now)).toBe(0);
  });
});
