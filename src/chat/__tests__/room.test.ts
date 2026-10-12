/**
 * A course has two rooms (founder 2026-10-12): the students' room and the parents' room.
 * On the client a room is one number — minus the course id for the parents' room — and only
 * the API layer and the socket turn it back into a course and `?room=parents`.
 */
import { isParentsRoom, parentsRoomOf, roomCourseId, roomIdOf, roomParams, roomPath, roomSocketChannel } from '../room';

describe('room ids', () => {
  it('the students\' room is the course id; the parents\' room is minus it', () => {
    expect(roomIdOf({ course_id: 12 })).toBe(12);
    expect(roomIdOf({ course_id: 12, audience: 'students' })).toBe(12);
    expect(roomIdOf({ course_id: 12, audience: 'parents' })).toBe(-12);
    expect(parentsRoomOf(12)).toBe(-12);
    expect(parentsRoomOf(-12)).toBe(-12);
    expect(isParentsRoom(-12)).toBe(true);
    expect(isParentsRoom(12)).toBe(false);
    expect(roomCourseId(-12)).toBe(12);
  });

  it('every call goes to the course, and the parents\' room adds ?room=parents', () => {
    expect(roomPath(-12, 'messages')).toBe('/chat/courses/12/messages');
    expect(roomPath(12, 'info')).toBe('/chat/courses/12/info');
    expect(roomParams(12)).toBeUndefined();
    expect(roomParams(-12)).toEqual({ room: 'parents' });
    expect(roomParams(-12, { after_id: 5 })).toEqual({ after_id: 5, room: 'parents' });
    expect(roomParams(12, { after_id: 5 })).toEqual({ after_id: 5 });
  });

  it('each room has its own socket channel', () => {
    expect(roomSocketChannel(12)).toBe('chat.course.12');
    expect(roomSocketChannel(-12)).toBe('chat.parents.12');
    expect(roomSocketChannel(12, 'chat.course.')).toBe('chat.course.12');
  });
});
