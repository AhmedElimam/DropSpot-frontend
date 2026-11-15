import { courseCreateProblems, type CourseCreateInput } from '../courseCreateCheck';

const ok: CourseCreateInput = {
  name: 'الثالث الإعدادي',
  gradeId: '3',
  termId: '7',
  startMode: 'now',
  startDate: null,
  slots: [{ day_of_week: 5, start_time: '10:00', end_time: '11:00' }],
  cycleSessions: '8',
  cyclePrice: '300',
};

describe('what stops «إنشاء مقرر»', () => {
  it('a complete form has nothing missing', () => {
    expect(courseCreateProblems(ok)).toEqual([]);
    expect(courseCreateProblems({ ...ok, slots: [] })).toEqual([]); // slots are optional
  });

  it('names every missing required field, in the form\'s order', () => {
    expect(courseCreateProblems({ ...ok, name: '  ', gradeId: null, termId: null, cycleSessions: '', cyclePrice: '' }).map((p) => p.kind))
      .toEqual(['name', 'grade', 'term', 'cycle_sessions', 'cycle_price']);
  });

  it('«بتاريخ محدد» needs a date', () => {
    expect(courseCreateProblems({ ...ok, startMode: 'date' })).toEqual([{ kind: 'start_date' }]);
    expect(courseCreateProblems({ ...ok, startMode: 'date', startDate: '2026-11-20' })).toEqual([]);
  });

  it('a slot that ends before it starts — 10 PM → 11 AM, the مساءً slip — is named with its number', () => {
    const slots = [ok.slots[0], { day_of_week: 6, start_time: '22:00', end_time: '11:00' }];
    expect(courseCreateProblems({ ...ok, slots })).toEqual([{ kind: 'slot', index: 1, reason: 'end_not_after_start' }]);
    expect(courseCreateProblems({ ...ok, slots: [{ day_of_week: 6, start_time: '10:00', end_time: '10:00' }] }))
      .toEqual([{ kind: 'slot', index: 0, reason: 'end_not_after_start' }]);
  });

  it('two of the form\'s own slots overlapping on the same day are named, both numbers', () => {
    const slots = [
      { day_of_week: 2, start_time: '17:00', end_time: '19:00' },
      { day_of_week: 3, start_time: '17:00', end_time: '19:00' }, // another day: fine
      { day_of_week: 2, start_time: '18:00', end_time: '20:00' }, // overlaps the first
      { day_of_week: 2, start_time: '19:00', end_time: '20:00' }, // starts as the first ends — but overlaps the third
    ];
    expect(courseCreateProblems({ ...ok, slots })).toEqual([
      { kind: 'slot_overlap', index: 2, other: 0 },
      { kind: 'slot_overlap', index: 3, other: 2 },
    ]);
    expect(courseCreateProblems({ ...ok, slots: [slots[0], { day_of_week: 2, start_time: '19:00', end_time: '20:00' }] })).toEqual([]);
  });

  it('a slot without a time is named too', () => {
    expect(courseCreateProblems({ ...ok, slots: [{ day_of_week: 6, start_time: '', end_time: '11:00' }] }))
      .toEqual([{ kind: 'slot', index: 0, reason: 'time_missing' }]);
  });

  it('a price below 1 or sessions below 1 count as missing', () => {
    expect(courseCreateProblems({ ...ok, cyclePrice: '0', cycleSessions: '0' }).map((p) => p.kind)).toEqual(['cycle_sessions', 'cycle_price']);
    expect(courseCreateProblems({ ...ok, cyclePrice: '0.5' }).map((p) => p.kind)).toEqual(['cycle_price']);
  });

  it('the server\'s own bounds are named before it answers in English: 4–20 sessions, prices, capacity', () => {
    expect(courseCreateProblems({ ...ok, cycleSessions: '3' }).map((p) => p.kind)).toEqual(['cycle_sessions']);
    expect(courseCreateProblems({ ...ok, cycleSessions: '21' }).map((p) => p.kind)).toEqual(['cycle_sessions']);
    expect(courseCreateProblems({ ...ok, cycleSessions: '4' })).toEqual([]);
    expect(courseCreateProblems({ ...ok, cycleSessions: '20' })).toEqual([]);
    expect(courseCreateProblems({ ...ok, cyclePrice: '1000001' }).map((p) => p.kind)).toEqual(['cycle_price']);
    expect(courseCreateProblems({ ...ok, capacity: '0' }).map((p) => p.kind)).toEqual(['capacity']);
    expect(courseCreateProblems({ ...ok, capacity: '1001' }).map((p) => p.kind)).toEqual(['capacity']);
    expect(courseCreateProblems({ ...ok, capacity: '' })).toEqual([]);
    expect(courseCreateProblems({ ...ok, capacity: '40' })).toEqual([]);
    const eight = Array.from({ length: 8 }, (_, i) => ({ day_of_week: i % 7, start_time: `1${i}:00`.slice(-5), end_time: `1${i}:30`.slice(-5) }));
    expect(courseCreateProblems({ ...ok, slots: eight }).map((p) => p.kind)).toEqual(['slots_count']);
  });
});
