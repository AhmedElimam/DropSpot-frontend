/**
 * The room as rows, the incremental poll's tail, the ticks from read thresholds, the calendar
 * grid and the shelf's months (founder 2026-10-12, «like Telegram»).
 */
import {
  applyRecentHidden, buildRows, chunk, fromYmd, groupByMonth, heat, lastDays, lastServerId, mergeById, mergeTail, monthBounds, monthGrid, rowKeyOf, seenFor,
} from '../roomView';
import type { ChatMessage } from '@/api/chat';

const s = (id: number) => ({ id, name: `u${id}`, is_staff: false, is_teacher: false });
const m = (id: number, at: string, sender = 1, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id, parent_id: null, kind: 'text', body: `#${id}`, hidden: false, attachment: null, sender: s(sender), created_at: at, ...extra,
});

describe('the incremental poll', () => {
  it('appends only what is new, in order, and caps the tail', () => {
    const prev = [m(1, '2026-10-01T10:00:00'), m(2, '2026-10-01T10:01:00')];
    expect(mergeTail(prev, [])).toBe(prev);
    expect(mergeTail(prev, [m(2, '2026-10-01T10:01:00')])).toBe(prev);
    expect(mergeTail(prev, [m(4, 'x'), m(3, 'x')]).map((x) => x.id)).toEqual([1, 2, 3, 4]);
    expect(mergeTail(prev, [m(3, 'x'), m(4, 'x')], 3).map((x) => x.id)).toEqual([2, 3, 4]);
    expect(lastServerId([m(-1, 'x'), m(7, 'x'), m(3, 'x')])).toBe(7);
  });

  it('a member drops a message withdrawn since; a moderator refetches to see it marked', () => {
    const held = [m(1, 'x'), m(2, 'x'), m(3, 'x', 1, { hidden: true })];
    expect(applyRecentHidden(held, [2], false)).toEqual({ messages: [held[0], held[2]], refetch: false });
    expect(applyRecentHidden(held, [2], true)).toEqual({ messages: held, refetch: true });
    // Already marked hidden, or not held at all: nothing to do.
    expect(applyRecentHidden(held, [3, 99], true)).toEqual({ messages: held, refetch: false });
    expect(applyRecentHidden(held, undefined, false).messages).toBe(held);
  });
});

describe('ticks from the room\'s read thresholds', () => {
  const mine = m(10, 'x');
  it('read by everyone up to `all`, by someone up to `some`, else sent', () => {
    expect(seenFor(mine, { some: 12, all: 10 })).toEqual({ count: 1, all: true });
    expect(seenFor(mine, { some: 10, all: 4 })).toEqual({ count: 1, all: false });
    expect(seenFor(mine, { some: 9, all: 4 })).toEqual({ count: 0, all: false });
    expect(seenFor({ ...mine, seen: { count: 3, all: false } }, undefined)).toEqual({ count: 3, all: false });
    expect(seenFor(m(-2, 'x'), { some: 99, all: 99 })).toBeNull();
  });
});

describe('rows', () => {
  it('a day chip before each day, the name once per run, the tail at the run\'s end', () => {
    const rows = buildRows([
      m(1, '2026-10-01T10:00:00', 1), m(2, '2026-10-01T10:01:00', 1), m(3, '2026-10-01T11:00:00', 2),
      m(4, '2026-10-02T09:00:00', 2),
    ]);
    expect(rows.map((r) => r.type)).toEqual(['day', 'msg', 'msg', 'msg', 'day', 'msg']);
    const msgs = rows.filter((r) => r.type === 'msg') as Extract<ReturnType<typeof buildRows>[number], { type: 'msg' }>[];
    expect(msgs.map((r) => [r.message.id, r.showName, r.showTail])).toEqual([[1, true, false], [2, false, true], [3, true, true], [4, true, true]]);
    expect(rowKeyOf({ id: 4 })).toBe('m-4');
    expect(rowKeyOf({ id: -1, local: { status: 'queued', key: 'ob-1' } })).toBe('l-ob-1');
  });

  it('a message sent from this phone keeps its waiting bubble\'s row key (no remount, no jump)', () => {
    const sentAs: Record<number, string> = { 7: 'ob-7' };
    const rows = buildRows([m(6, '2026-10-01T10:00:00', 1), m(7, '2026-10-01T10:01:00', 1)], (id) => sentAs[id]);
    const keys = rows.filter((r) => r.type === 'msg').map((r) => r.key);
    expect(keys).toEqual(['m-6', 'l-ob-7']);
  });

  it('history pages merge by id without duplicates', () => {
    expect(mergeById([m(3, 'x'), m(1, 'x')], [m(2, 'x'), m(3, 'x')]).map((x) => x.id)).toEqual([1, 2, 3]);
  });
});

describe('the calendar', () => {
  it('October 2026 starts on a Thursday: five blank Saturday-first cells', () => {
    const weeks = monthGrid(2026, 9);
    expect(weeks[0].slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(weeks[0][5]).toBe('2026-10-01');
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(monthBounds(2026, 1)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('busy days shade by share of the busiest; the strip fills silent days with zero', () => {
    expect(heat(0, 10)).toBe(0);
    expect(heat(1, 10)).toBe(1);
    expect(heat(10, 10)).toBe(4);
    const strip = lastDays({ '2026-10-11': 3 }, 3, new Date(2026, 9, 12));
    expect(strip).toEqual([{ date: '2026-10-10', count: 0 }, { date: '2026-10-11', count: 3 }, { date: '2026-10-12', count: 0 }]);
    expect(fromYmd('2026-10-05').getDate()).toBe(5);
  });
});

describe('the shelf', () => {
  it('groups by month, newest first, and lays photos three to a row', () => {
    const g = groupByMonth([m(5, '2026-10-03T10:00:00'), m(4, '2026-10-01T10:00:00'), m(3, '2026-09-20T10:00:00')]);
    expect(g.map((x) => [x.key, x.items.length])).toEqual([['2026-10', 2], ['2026-09', 1]]);
    expect(chunk([1, 2, 3, 4, 5], 3)).toEqual([[1, 2, 3], [4, 5]]);
  });
});
