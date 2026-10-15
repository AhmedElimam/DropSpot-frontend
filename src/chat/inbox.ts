import type { ChatChannelSummary } from '@/api/chat';
import { foldForSearch } from '@/utils/format';

/**
 * The conversations list, as data (founder 2026-10-12: «some love on the chat list … it looks
 * like a mess»). Since a course has two rooms, a teacher's list was every course twice,
 * interleaved by activity. Now a course is ONE card holding its rooms; a student, who has one
 * room per course, keeps a plain messenger list.
 */

/** all · unread · the students' rooms (a parent's «أبنائي») · the parents' rooms. */
export type InboxFilter = 'all' | 'unread' | 'students' | 'parents';

export interface InboxGroup {
  courseId: number;
  name: string;
  /** A parent's children in this course (first names). */
  children: string[];
  rooms: ChatChannelSummary[];
  unread: number;
  /** Newest activity across the course's rooms, epoch ms (0 = never). */
  lastAt: number;
}

const isParents = (c: ChatChannelSummary) => c.audience === 'parents';
const at = (c: ChatChannelSummary) => (c.last_message_at ? Date.parse(c.last_message_at) || 0 : 0);

/** The students' room first, then the parents' room, then a room a parent only follows. */
export function roomRank(c: ChatChannelSummary): number {
  if (c.read_only) return 2;
  return isParents(c) ? 1 : 0;
}

/** Does this person have both kinds of room (teacher, assistant, parent)? Then the list groups by course. */
export function hasBothAudiences(list: ChatChannelSummary[]): boolean {
  return list.some(isParents) && list.some((c) => !isParents(c));
}

export function inboxCounts(list: ChatChannelSummary[]): Record<InboxFilter, number> {
  return {
    all: list.length,
    unread: list.filter((c) => c.unread > 0).length,
    students: list.filter((c) => !isParents(c)).length,
    parents: list.filter(isParents).length,
  };
}

export function filterInbox(list: ChatChannelSummary[], filter: InboxFilter, query = ''): ChatChannelSummary[] {
  const q = foldForSearch(query.trim());
  return list.filter((c) => {
    if (filter === 'unread' && !(c.unread > 0)) return false;
    if (filter === 'students' && isParents(c)) return false;
    if (filter === 'parents' && !isParents(c)) return false;
    if (!q) return true;
    return [c.course_name ?? '', ...(c.children ?? [])].some((s) => foldForSearch(s).includes(q));
  });
}

/** One card per course, newest activity first; inside, the rooms in a fixed order. */
export function groupInbox(list: ChatChannelSummary[]): InboxGroup[] {
  const by = new Map<number, InboxGroup>();
  for (const c of list) {
    let g = by.get(c.course_id);
    if (!g) {
      g = { courseId: c.course_id, name: c.course_name ?? '—', children: [], rooms: [], unread: 0, lastAt: 0 };
      by.set(c.course_id, g);
    }
    g.rooms.push(c);
    g.unread += c.unread || 0;
    g.lastAt = Math.max(g.lastAt, at(c));
    for (const k of c.children ?? []) if (!g.children.includes(k)) g.children.push(k);
  }
  const out = [...by.values()];
  for (const g of out) g.rooms.sort((a, b) => roomRank(a) - roomRank(b));
  return out.sort((a, b) => b.lastAt - a.lastAt || a.name.localeCompare(b.name, 'ar'));
}

/** A plain list (one room per course): newest activity first. */
export function sortRooms(list: ChatChannelSummary[]): ChatChannelSummary[] {
  return [...list].sort((a, b) => at(b) - at(a) || (a.course_name ?? '').localeCompare(b.course_name ?? '', 'ar'));
}
