/**
 * The optimistic-send reducers: a message is on screen before the server confirms it, becomes
 * the real one in place, is never duplicated when the socket echo wins the race, and never
 * silently disappears on failure.
 */
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.2.2', hostUri: '127.0.0.1:8081' } }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

import { appendLocal, failLocal, localChatMessage, removeLocal, resolveLocal } from '../useChat';
import type { ChatMessage, ChatRoom, ChatSender } from '@/api/chat';

const me: ChatSender = { id: 7, name: 'أحمد', is_staff: false, is_teacher: false };

function room(messages: ChatMessage[] = []): ChatRoom {
  return {
    course: { id: 1, name: 'C', teacher_name: null, members: 3 },
    role: 'student', can_post: true, post_blocked_reason: null, locked: false, announcements_only: false,
    page_size: 50, mute: null, report_reasons: {}, blocked_user_ids: [], realtime: null,
    limits: { image_max_kb: 1, file_max_kb: 1, voice_max_seconds: 1 },
    messages,
  } as unknown as ChatRoom;
}

function real(id: number, body: string): ChatMessage {
  return { id, parent_id: null, kind: 'text', body, hidden: false, attachment: null, sender: me, created_at: '2026-09-20T10:00:00Z' };
}

describe('sending a message', () => {
  it('puts it on screen at once, marked as sending, with a placeholder id', () => {
    const m = localChatMessage({ key: 'k1', body: 'مرحبا', sender: me });
    const r = appendLocal(room([real(1, 'a')]), m)!;
    expect(r.messages).toHaveLength(2);
    expect(r.messages[1].local).toEqual({ status: 'sending', key: 'k1' });
    expect(r.messages[1].id).toBeLessThan(0);
  });

  it('does nothing when the room is not cached yet — there is nowhere to show it', () => {
    expect(appendLocal(undefined, localChatMessage({ key: 'k', body: 'x', sender: me }))).toBeUndefined();
  });
});

describe('when the server answers', () => {
  it('the optimistic row becomes the real message IN PLACE', () => {
    const m = localChatMessage({ key: 'k1', body: 'مرحبا', sender: me });
    const before = appendLocal(room([real(1, 'a')]), m)!;
    const after = resolveLocal(appendLocal(before, real(2, 'later'))!, 'k1', real(9, 'مرحبا'))!;
    expect(after.messages.map((x) => x.id)).toEqual([1, 9, 2]);
    expect(after.messages[1].local).toBeUndefined();
  });

  it('never shows the message twice when the socket echo arrived first', () => {
    const m = localChatMessage({ key: 'k1', body: 'مرحبا', sender: me });
    const withEcho = appendLocal(appendLocal(room(), m)!, real(9, 'مرحبا'))!; // echo landed before HTTP
    const after = resolveLocal(withEcho, 'k1', real(9, 'مرحبا'))!;
    expect(after.messages.map((x) => x.id)).toEqual([9]);
  });

  it('still adds the real message if the optimistic row was discarded meanwhile — the server has it', () => {
    const after = resolveLocal(room([real(1, 'a')]), 'gone', real(9, 'b'))!;
    expect(after.messages.map((x) => x.id)).toEqual([1, 9]);
  });
});

describe('when the send fails', () => {
  it('the row STAYS, marked failed — nothing typed is silently lost', () => {
    const m = localChatMessage({ key: 'k1', body: 'مرحبا', sender: me });
    const after = failLocal(appendLocal(room(), m)!, 'k1')!;
    expect(after.messages).toHaveLength(1);
    expect(after.messages[0].local).toEqual({ status: 'failed', key: 'k1' });
    expect(after.messages[0].body).toBe('مرحبا');
  });

  it('is removed only when the sender gives it up', () => {
    const m = localChatMessage({ key: 'k1', body: 'x', sender: me });
    const after = removeLocal(failLocal(appendLocal(room([real(1, 'a')]), m)!, 'k1'), 'k1')!;
    expect(after.messages.map((x) => x.id)).toEqual([1]);
  });
});
