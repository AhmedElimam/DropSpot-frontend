/**
 * The room poll asks only for what is newer (founder 2026-10-12: an idle room cost 25 queries
 * and 14 KB every 8 seconds), with a full page first, every two minutes, and whenever the
 * delta cannot be trusted.
 */
const mockGetChatRoom = jest.fn();
jest.mock('@/api/chat', () => ({ getChatRoom: (...a: unknown[]) => mockGetChatRoom(...a) }));
jest.mock('@/hooks/useFeatureFlags', () => ({ useFeatureFlags: () => ({ data: {} }) }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: () => null }));

import { CHAT_FULL_REFRESH_MS, pollChatRoom } from '../useChat';

const msg = (id: number) => ({ id, parent_id: null, kind: 'text', body: String(id), hidden: false, attachment: null, sender: { id: 1, name: 'a', is_staff: false, is_teacher: false }, created_at: 'x' });
const room = (ids: number[], extra: Record<string, unknown> = {}) => ({ role: 'student', messages: ids.map(msg), ...extra });

describe('pollChatRoom', () => {
  beforeEach(() => mockGetChatRoom.mockReset());

  it('starts with a full page, then asks only after the newest id and appends', async () => {
    mockGetChatRoom.mockResolvedValueOnce(room([1, 2]));
    const first = await pollChatRoom(7, undefined, 1_000);
    expect(mockGetChatRoom).toHaveBeenLastCalledWith(7);

    mockGetChatRoom.mockResolvedValueOnce(room([3], { window: { mode: 'after', has_more_after: false } }));
    const next = await pollChatRoom(7, first as never, 2_000);
    expect(mockGetChatRoom).toHaveBeenLastCalledWith(7, { afterId: 2 });
    expect(next.messages.map((m) => m.id)).toEqual([1, 2, 3]);

    // Nothing new: the same messages, nothing resent.
    mockGetChatRoom.mockResolvedValueOnce(room([], { window: { mode: 'after', has_more_after: false } }));
    const idle = await pollChatRoom(7, next as never, 3_000);
    expect(idle.messages).toBe(next.messages);
  });

  it('falls back to a full page: after two minutes, a long absence, or an older server', async () => {
    mockGetChatRoom.mockResolvedValueOnce(room([1]));
    const first = await pollChatRoom(8, undefined, 0);
    mockGetChatRoom.mockResolvedValueOnce(room([1, 2]));
    await pollChatRoom(8, first as never, CHAT_FULL_REFRESH_MS + 1);
    expect(mockGetChatRoom).toHaveBeenLastCalledWith(8);

    mockGetChatRoom.mockResolvedValueOnce(room([2], { window: { mode: 'after', has_more_after: true } })).mockResolvedValueOnce(room([60, 61]));
    const away = await pollChatRoom(8, first as never, CHAT_FULL_REFRESH_MS + 10);
    expect(away.messages.map((m) => m.id)).toEqual([60, 61]);

    mockGetChatRoom.mockResolvedValueOnce(room([1, 2, 3])); // no `window`: an older server sent the latest page
    const old = await pollChatRoom(8, first as never, CHAT_FULL_REFRESH_MS + 20);
    expect(old.messages.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it('drops a message withdrawn since the last poll', async () => {
    mockGetChatRoom.mockResolvedValueOnce(room([1, 2]));
    const first = await pollChatRoom(9, undefined, 0);
    mockGetChatRoom.mockResolvedValueOnce(room([], { window: { mode: 'after', has_more_after: false }, recent_hidden_ids: [2] }));
    const next = await pollChatRoom(9, first as never, 1_000);
    expect(next.messages.map((m) => m.id)).toEqual([1]);
  });
});
