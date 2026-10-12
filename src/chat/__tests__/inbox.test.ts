/**
 * The conversations list (founder 2026-10-12: «it looks like a mess»): a course with two rooms
 * is one card holding both, in a fixed order; filters and search narrow the rooms.
 */
import { filterInbox, groupInbox, hasBothAudiences, inboxCounts, roomRank, sortRooms } from '../inbox';
import type { ChatChannelSummary } from '@/api/chat';

const room = (course_id: number, over: Partial<ChatChannelSummary> = {}): ChatChannelSummary => ({
  course_id, course_name: `مقرر ${course_id}`, unread: 0, notify: true, locked: false, announcements_only: false,
  last_message_at: null, last_preview: null, last_sender: null, last_mine: false, ...over,
});

describe('conversations list', () => {
  const teacher = [
    room(1, { audience: 'parents', last_message_at: '2026-10-12T09:00:00Z', unread: 2 }),
    room(2, { audience: 'students', last_message_at: '2026-10-12T08:00:00Z' }),
    room(1, { audience: 'students', last_message_at: '2026-10-11T08:00:00Z', unread: 1 }),
    room(2, { audience: 'parents' }),
  ];

  it('one card per course, newest first; the students\' room before the parents\'', () => {
    const g = groupInbox(teacher);
    expect(g.map((x) => x.courseId)).toEqual([1, 2]);
    expect(g[0].rooms.map((r) => r.audience)).toEqual(['students', 'parents']);
    expect(g[0].unread).toBe(3);
  });

  it('a parent: their own room first, the child\'s followed room after, the child named on the card', () => {
    const parent = [
      room(5, { audience: 'students', read_only: true, children: ['أحمد'] }),
      room(5, { audience: 'parents', children: ['أحمد'] }),
    ];
    const [card] = groupInbox(parent);
    expect(card.rooms.map((r) => roomRank(r))).toEqual([1, 2]);
    expect(card.children).toEqual(['أحمد']);
  });

  it('groups only when there are both kinds of room; a student keeps a plain list', () => {
    expect(hasBothAudiences(teacher)).toBe(true);
    const student = [room(1, { last_message_at: '2026-10-10T00:00:00Z' }), room(2, { last_message_at: '2026-10-12T00:00:00Z' })];
    expect(hasBothAudiences(student)).toBe(false);
    expect(sortRooms(student).map((r) => r.course_id)).toEqual([2, 1]);
  });

  it('filters and search', () => {
    expect(inboxCounts(teacher)).toEqual({ all: 4, unread: 2, students: 2, parents: 2 });
    expect(filterInbox(teacher, 'unread').length).toBe(2);
    expect(filterInbox(teacher, 'parents').every((r) => r.audience === 'parents')).toBe(true);
    expect(filterInbox(teacher, 'all', 'مقرر 2').map((r) => r.course_id)).toEqual([2, 2]);
    expect(filterInbox([room(9, { children: ['سارة'] })], 'all', 'ساره').length).toBe(1);
  });
});
