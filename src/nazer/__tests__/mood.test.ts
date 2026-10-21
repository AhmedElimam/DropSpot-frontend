import { parentSay, studentSay } from '../mood';

jest.mock('@/utils/currency', () => ({ formatEGP: (n: number) => `${n} ج.م` }));

const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${JSON.stringify(opts)}` : key);
const now = new Date('2026-10-22T10:00:00');
const kid = (name: string, rate: number, present = 10, absent = 1) => ({ name, student_id: 1, attendance_rate: rate, present_count: present, absent_count: absent });

describe('الناظر — what he says to a parent', () => {
  it('a bill that stops the door comes first, stamped «لفت نظر»', () => {
    const say = parentSay({ children: [kid('يوسف', 95)], billing: [{ student_id: 1, student_name: 'يوسف', amount: 300, blocking: true }], risks: [{ student_id: 1, absences: 3 }], now }, t);
    expect(say.mood).toBe('stern');
    expect(say.stamp).toBe('notice');
    expect(say.line).toContain('due_blocking');
    expect(say.line).toContain('300 ج.م');
    expect(say.route).toContain('invoices');
  });

  it('a plain overdue bill makes him a little sad, not stern', () => {
    const say = parentSay({ children: [], billing: [{ student_id: 1, amount: 120, blocking: false }], risks: [], now }, t);
    expect(say.mood).toBe('sad');
    expect(say.stamp).toBeUndefined();
  });

  it('absences come before a teacher message, and point at the child', () => {
    const say = parentSay({ children: [kid('سارة', 70)], billing: [], risks: [{ student_id: 7, student_name: 'سارة', course_name: 'رياضيات', absences: 2 }], latestNotification: { type: 'ticket_new', created_at: now.toISOString() }, now }, t);
    expect(say.mood).toBe('tender');
    expect(say.route).toBe('/(parent)/child/7');
  });

  it('a fresh ticket from the teacher gets the checking face; an old one does not', () => {
    const fresh = parentSay({ children: [kid('يوسف', 80)], billing: [], risks: [], latestNotification: { type: 'ticket_new', created_at: '2026-10-21T20:00:00' }, now }, t);
    expect(fresh.mood).toBe('checking');
    const old = parentSay({ children: [kid('يوسف', 80)], billing: [], risks: [], latestNotification: { type: 'ticket_new', created_at: '2026-10-01T20:00:00' }, now }, t);
    expect(old.mood).toBe('neutral');
  });

  it('a full month for every child is stamped «اعتمد»; a thin record is not', () => {
    expect(parentSay({ children: [kid('أ', 95), kid('ب', 92)], billing: [], risks: [], now }, t)).toMatchObject({ mood: 'proud', stamp: 'approved' });
    expect(parentSay({ children: [kid('أ', 100, 2, 0)], billing: [], risks: [], now }, t).mood).toBe('neutral');
  });

  it('no children: a welcome; otherwise the day\'s line, the same all day', () => {
    expect(parentSay({ children: [], billing: [], risks: [], now }, t).line).toBe('nazer.parent.welcome');
    const a = parentSay({ children: [kid('أ', 80)], billing: [], risks: [], now }, t).line;
    const b = parentSay({ children: [kid('أ', 80)], billing: [], risks: [], now: new Date('2026-10-22T22:00:00') }, t).line;
    expect(a).toBe(b);
    expect(a).toMatch(/nazer\.parent\.daily_[1-4]/);
  });
});

describe('الناظر — what he says to a student', () => {
  const coverage = { present: 9, late: 0, absent: 1, total: 10 };
  it('a live session they have not entered beats everything but money', () => {
    const say = studentSay({ billing: [], risks: [{ absences: 3 }], coverage, live: { course_name: 'كيمياء', checked_in: false }, now }, t);
    expect(say.mood).toBe('checking');
    expect(say.line).toContain('live_now');
    expect(say.route).toContain('check-in');
  });

  it('once checked in, the live session is no longer his concern', () => {
    const say = studentSay({ billing: [], risks: [], coverage, live: { course_name: 'كيمياء', checked_in: true }, now }, t);
    expect(say.mood).toBe('proud');
  });

  it('a session within two hours gets a reminder; further away, the daily line', () => {
    const soon = studentSay({ billing: [], risks: [], coverage: { present: 5, late: 0, absent: 2, total: 7 }, next: { course_name: 'فيزياء', scheduled_at: '2026-10-22T11:30:00' }, now }, t);
    expect(soon.line).toContain('soon');
    const later = studentSay({ billing: [], risks: [], coverage: { present: 5, late: 0, absent: 2, total: 7 }, next: { course_name: 'فيزياء', scheduled_at: '2026-10-22T18:30:00' }, now }, t);
    expect(later.line).toMatch(/daily_/);
  });
});
