/**
 * Which room a screen is in. A course has two (founder 2026-10-12): the STUDENTS' room —
 * its children's parents follow it, reading only — and the PARENTS' room, where the teacher
 * and the enrolled children's parents talk. No student is ever in the parents' room.
 *
 * On this client a room is one number, so the whole chat stack (query keys, the outbox, the
 * jump store, route params) carries it unchanged: the course id for the students' room, and
 * MINUS the course id for the parents' room. Only the API layer and the socket turn it back
 * into a course and `?room=parents`.
 */
export type RoomId = number;

export function isParentsRoom(room: RoomId): boolean {
  return room < 0;
}

export function roomCourseId(room: RoomId): number {
  return Math.abs(room);
}

export function parentsRoomOf(courseId: number): RoomId {
  return -Math.abs(courseId);
}

/** A room-list row's id: the server says the course and whose room it is. */
export function roomIdOf(row: { course_id: number; audience?: string | null }): RoomId {
  return row.audience === 'parents' ? parentsRoomOf(row.course_id) : row.course_id;
}

/** The URL of a course-scoped chat endpoint, and the query that picks the room. */
export function roomPath(room: RoomId, tail: string): string {
  return `/chat/courses/${roomCourseId(room)}/${tail}`;
}

export function roomParams(room: RoomId, extra?: Record<string, string | number>): Record<string, string | number> | undefined {
  const p = { ...(extra ?? {}), ...(isParentsRoom(room) ? { room: 'parents' } : {}) };
  return Object.keys(p).length ? p : undefined;
}

/** The room's private socket channel (server `ChatChannel::broadcastName`). */
export function roomSocketChannel(room: RoomId, studentsPrefix = 'chat.course.'): string {
  return isParentsRoom(room) ? `chat.parents.${roomCourseId(room)}` : `${studentsPrefix}${roomCourseId(room)}`;
}
