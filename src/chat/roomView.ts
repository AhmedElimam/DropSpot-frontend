import type { ChatMessage } from '@/api/chat';

/**
 * The room as rows on a screen — pure functions, tested without a phone.
 *
 * The room list is an INVERTED list (newest at index 0, at the bottom), which is what makes
 * a chat stick to its newest message, keep its place when older pages load above, and open
 * any day of its history without measuring the whole past (founder 2026-10-12, «like
 * Telegram»). These helpers build the rows, keep the incremental poll's tail, and turn the
 * read thresholds into ticks.
 */

/** Keep this many server messages in the live cache; older ones reload on scroll. */
export const TAIL_CAP = 300;

/** The newest id the server has given us (optimistic rows have negative ids). */
export function lastServerId(messages: ChatMessage[]): number {
  let max = 0;
  for (const m of messages) if (m.id > max) max = m.id;
  return max;
}

/**
 * An incremental poll's answer folded into what the room already holds: new ids appended in
 * order, nothing duplicated, the oldest dropped past the cap.
 */
export function mergeTail(prev: ChatMessage[], fresh: ChatMessage[], cap: number = TAIL_CAP): ChatMessage[] {
  if (!fresh.length) return prev;
  const seen = new Set(prev.map((m) => m.id));
  const added = fresh.filter((m) => !seen.has(m.id));
  if (!added.length) return prev;
  const all = [...prev, ...added].sort((a, b) => a.id - b.id);
  return all.length > cap ? all.slice(all.length - cap) : all;
}

/**
 * What to do with messages withdrawn or removed since the last poll: a member's room drops
 * them; a moderator's room must refetch, because a moderator still sees a removed message —
 * marked — and the poll does not resend it.
 */
export function applyRecentHidden(messages: ChatMessage[], hiddenIds: number[] | undefined, moderator: boolean): { messages: ChatMessage[]; refetch: boolean } {
  if (!hiddenIds?.length) return { messages, refetch: false };
  const hidden = new Set(hiddenIds);
  const held = messages.filter((m) => hidden.has(m.id) && !m.hidden);
  if (!held.length) return { messages, refetch: false };
  if (moderator) return { messages, refetch: true };
  return { messages: messages.filter((m) => !hidden.has(m.id)), refetch: false };
}

/**
 * The tick on one of MY messages, from the room's read thresholds: read by everyone up to
 * `all`, by someone up to `some`. Falls back to the message's own `seen` (older servers).
 */
export function seenFor(m: ChatMessage, seenUpto: { some: number; all: number } | undefined): ChatMessage['seen'] {
  if (!seenUpto || m.id <= 0) return m.seen ?? null;
  if (m.id <= seenUpto.all) return { count: Math.max(1, m.seen?.count ?? 1), all: true };
  if (m.id <= seenUpto.some) return { count: Math.max(1, m.seen?.count ?? 1), all: false };
  return m.seen && m.seen.count > 0 ? m.seen : { count: 0, all: false };
}

/** The local calendar day of a timestamp, as YYYY-MM-DD. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return ymd(d);
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type RoomRow =
  | { type: 'day'; key: string; date: string }
  | { type: 'msg'; key: string; message: ChatMessage; showName: boolean; showTail: boolean };

/**
 * Chronological rows: a day chip before each day's first message; a run from one sender shows
 * the name once and the tail once. The list reverses this for its inverted order.
 */
export function buildRows(messages: ChatMessage[]): RoomRow[] {
  const rows: RoomRow[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const day = dayKey(m.created_at);
    const newDay = !prev || dayKey(prev.created_at) !== day;
    if (newDay) rows.push({ type: 'day', key: `d-${day}-${m.id}`, date: m.created_at });
    const sameRun = !!prev && !newDay && prev.sender.id === m.sender.id;
    const runEnds = !next || next.sender.id !== m.sender.id || dayKey(next.created_at) !== day;
    rows.push({ type: 'msg', key: m.local ? `l-${m.local.key}` : `m-${m.id}`, message: m, showName: !sameRun, showTail: runEnds });
  }
  return rows;
}

/** The row key a message renders under (to scroll to it). */
export function rowKeyOf(m: Pick<ChatMessage, 'id' | 'local'>): string {
  return m.local ? `l-${m.local.key}` : `m-${m.id}`;
}

/** Merge pages of history by id, oldest first, without duplicates. */
export function mergeById(...lists: ChatMessage[][]): ChatMessage[] {
  const map = new Map<number, ChatMessage>();
  for (const list of lists) for (const m of list) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.id - b.id);
}

// ── Calendar ─────────────────────────────────────────────────────────────────────────────

/**
 * A month as weeks of seven cells, Saturday first (the Egyptian week), with nulls before the
 * 1st and after the last day.
 */
export function monthGrid(year: number, month0: number): (string | null)[][] {
  const first = new Date(year, month0, 1);
  const days = new Date(year, month0 + 1, 0).getDate();
  const lead = (first.getDay() + 1) % 7; // Sat=0 … Fri=6
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(ymd(new Date(year, month0, d)));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function monthBounds(year: number, month0: number): { from: string; to: string } {
  return { from: ymd(new Date(year, month0, 1)), to: ymd(new Date(year, month0 + 1, 0)) };
}

/** 0 … 4: how busy a day was, relative to the busiest day shown. */
export function heat(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.max(1, Math.min(4, Math.ceil((count / max) * 4)));
}

/** The last N days ending today, oldest first, with their counts (0 where none). */
export function lastDays(days: Record<string, number>, n: number, today: Date = new Date()): { date: string; count: number }[] {
  const out: { date: string; count: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const k = ymd(d);
    out.push({ date: k, count: days[k] ?? 0 });
  }
  return out;
}

// ── The shelf ────────────────────────────────────────────────────────────────────────────

/** Items grouped under month headings (newest first, as the shelf pages them). */
export function groupByMonth<T extends { created_at: string }>(items: T[]): { key: string; first: string; items: T[] }[] {
  const groups: { key: string; first: string; items: T[] }[] = [];
  for (const it of items) {
    const k = dayKey(it.created_at).slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === k) last.items.push(it);
    else groups.push({ key: k, first: it.created_at, items: [it] });
  }
  return groups;
}

/** Split into rows of `n` (the photo grid). */
export function chunk<T>(items: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/** YYYY-MM-DD as a LOCAL date (a bare ISO date string would parse as UTC midnight). */
export function fromYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
