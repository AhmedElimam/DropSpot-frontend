/**
 * The chat outbox: a message you send stays on screen through every poll, survives a dead
 * network and a restart, sends itself in order when it can, and a server refusal waits for
 * a human (founder 2026-10-12: «fail to send removes that failed message … we want it cached
 * and offline friendly, auto sync when the user's back online»).
 */
import {
  afterRestart, classifyError, durableFileName, enqueueItem, mergeOutbox, nextToSend, outboxToMessage, removeItem, setItemStatus,
  type OutboxItem,
} from '../outboxCore';
import type { ChatMessage } from '@/api/chat';

const sender = { id: 5, name: 'أحمد', is_staff: false, is_teacher: false };
const item = (key: string, over: Partial<OutboxItem> = {}): OutboxItem => ({
  key, courseId: 9, body: `m-${key}`, attachment: null, sender,
  created_at: '2026-10-12T10:00:00.000Z', status: 'queued', error: null, attempts: 0, ...over,
});
const server = (id: number): ChatMessage => ({
  id, parent_id: null, kind: 'text', body: `s${id}`, hidden: false, attachment: null, sender, created_at: '2026-10-12T09:00:00.000Z',
});

describe('outbox core', () => {
  it('queues once per key and sends oldest first, one at a time', () => {
    let items = enqueueItem([], item('a'));
    items = enqueueItem(items, item('b'));
    items = enqueueItem(items, item('a'));
    expect(items.map((x) => x.key)).toEqual(['a', 'b']);
    expect(nextToSend(items)?.key).toBe('a');
    items = setItemStatus(items, 'a', 'sending');
    expect(nextToSend(items)).toBeNull(); // one on the wire → wait
    expect(items[0].attempts).toBe(1);
    items = removeItem(items, 'a');
    expect(nextToSend(items)?.key).toBe('b');
  });

  it('a refusal is final until retried; the next message still goes', () => {
    let items = [item('a'), item('b')];
    items = setItemStatus(items, 'a', 'failed', 'ممنوع من الكتابة');
    expect(nextToSend(items)?.key).toBe('b');
    expect(items[0].error).toBe('ممنوع من الكتابة');
    items = setItemStatus(items, 'a', 'queued');
    expect(nextToSend(items)?.key).toBe('a');
  });

  it('after a restart nothing is on the wire: sending becomes queued again', () => {
    const items = afterRestart([item('a', { status: 'sending' }), item('b', { status: 'failed' })]);
    expect(items.map((x) => x.status)).toEqual(['queued', 'failed']);
  });

  it('the room draws the outbox AFTER the server page, so a poll never drops it', () => {
    const merged = mergeOutbox([server(1), server(2)], [item('a'), item('x', { courseId: 3 }), item('b', { status: 'failed' })], 9);
    expect(merged.map((m) => m.id)).toEqual([1, 2, -1, -2]);
    expect(merged[2].local).toEqual({ status: 'queued', key: 'a' });
    expect(merged[3].local).toEqual({ status: 'failed', key: 'b' });
    expect(merged[2].body).toBe('m-a');
    // Another room's item stays out of this one.
    expect(merged.some((m) => m.local?.key === 'x')).toBe(false);
    // Nothing queued → the server list itself, untouched.
    const same = [server(1)];
    expect(mergeOutbox(same, [], 9)).toBe(same);
  });

  it('an attachment is drawn from its local file until the server has it', () => {
    const m = outboxToMessage(item('v', { body: null, attachment: { kind: 'voice', uri: 'file:///x/ob-v.m4a', name: 'DrosSpot_VOICE_1.m4a', mime: 'audio/mp4', duration: 7 } }), 0);
    expect(m.kind).toBe('voice');
    expect(m.attachment).toMatchObject({ kind: 'voice', url: 'file:///x/ob-v.m4a', duration: 7, expired: false });
  });

  it('no answer or a 5xx is the network (wait); a 4xx is the server (failed)', () => {
    expect(classifyError(new Error('Network Error'))).toBe('network');
    expect(classifyError({ code: 'ECONNABORTED' })).toBe('network');
    expect(classifyError({ response: { status: 502 } })).toBe('network');
    expect(classifyError({ response: { status: 403 } })).toBe('rejected');
    expect(classifyError({ response: { status: 422 } })).toBe('rejected');
  });

  it('the durable copy is named by the key, with a safe extension', () => {
    expect(durableFileName('ob-1', 'إيصال.PDF')).toBe('ob-1.pdf');
    expect(durableFileName('ob-2', 'noext')).toBe('ob-2.noext');
    expect(durableFileName('ob-3', 'a.m4a')).toBe('ob-3.m4a');
  });
});

describe('outbox store + flush', () => {
  const send = jest.fn();
  const upload = jest.fn();
  beforeEach(() => {
    jest.resetModules();
    send.mockReset();
    upload.mockReset();
    jest.doMock('expo-sqlite/kv-store', () => { throw new Error('no native store in tests'); });
    jest.doMock('expo-file-system', () => { throw new Error('no fs in tests'); });
    jest.doMock('@/api/chat', () => ({ sendChatMessage: send, uploadChatAttachment: upload }));
    jest.doMock('@/hooks/useChat', () => ({ mergeChatMessage: jest.fn() }));
    jest.doMock('@/lib/queryClientRef', () => ({ getQueryClient: () => null }));
    jest.doMock('@/stores/offlineStore', () => ({ useOfflineStore: { getState: () => ({ online: true, setOnline: jest.fn() }) } }));
    jest.doMock('@/utils/errors', () => ({ getFriendlyErrorMessage: (e: { response?: { data?: { message?: string } } }) => e?.response?.data?.message ?? 'x' }));
  });

  it('sends in order, stops at a network failure, keeps the rest queued, and resumes', async () => {
    const ob = require('../outbox') as typeof import('../outbox');
    send.mockRejectedValue(new Error('Network Error'));
    ob.enqueueChatMessage({ courseId: 9, body: 'one', sender });
    ob.enqueueChatMessage({ courseId: 9, body: 'two', sender });
    await ob.flushChatOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(ob.useChatOutbox.getState().items.map((x) => x.status)).toEqual(['queued', 'queued']);

    // The network is back.
    send.mockImplementation(async (_c: number, body: string) => ({ id: body === 'one' ? 11 : 12, body }));
    await ob.flushChatOutbox();
    expect(send.mock.calls.map((c) => c[1])).toEqual(['one', 'one', 'two']);
    expect(ob.useChatOutbox.getState().items).toEqual([]);
  });

  it('a refusal marks the message failed with the server\'s sentence and lets the next one through', async () => {
    const ob = require('../outbox') as typeof import('../outbox');
    send.mockImplementation(async (_c: number, body: string) => {
      if (body === 'bad') throw { response: { status: 403, data: { message: 'أنت موقوف عن الكتابة' } } };
      return { id: 20, body };
    });
    ob.enqueueChatMessage({ courseId: 9, body: 'bad', sender });
    ob.enqueueChatMessage({ courseId: 9, body: 'ok', sender });
    await ob.flushChatOutbox();
    const items = ob.useChatOutbox.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ body: 'bad', status: 'failed', error: 'أنت موقوف عن الكتابة' });

    // Retry sends it again; discard lets it go.
    send.mockResolvedValue({ id: 21, body: 'bad' });
    ob.retryChatOutbox(items[0].key);
    await ob.flushChatOutbox();
    expect(ob.useChatOutbox.getState().items).toEqual([]);
  });

  it('an attachment goes through the upload door with its caption', async () => {
    const ob = require('../outbox') as typeof import('../outbox');
    upload.mockResolvedValue({ id: 30 });
    ob.enqueueChatMessage({ courseId: 9, body: 'شرح', attachment: { kind: 'file', uri: 'file:///c/x.pdf', name: 'ملزمة.pdf', mime: 'application/pdf' }, sender });
    await ob.flushChatOutbox();
    expect(upload).toHaveBeenCalledWith(9, expect.objectContaining({ kind: 'file', uri: 'file:///c/x.pdf', name: 'ملزمة.pdf', body: 'شرح' }));
    expect(ob.outboxCount()).toBe(0);
  });

  it('a reply goes out with the message it answers, and the waiting bubble shows the quote', async () => {
    const ob = require('../outbox') as typeof import('../outbox');
    const core = require('../outboxCore') as typeof import('../outboxCore');
    send.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue({ id: 40 });
    const quote = { id: 7, sender_id: 2, sender_name: 'منى', kind: 'text' as const, hidden: false, preview: 'السؤال؟' };
    ob.enqueueChatMessage({ courseId: 9, body: 'الإجابة', sender, replyTo: quote });
    await ob.flushChatOutbox();
    const waiting = core.outboxToMessage(ob.useChatOutbox.getState().items[0], 0);
    expect(waiting.parent_id).toBe(7);
    expect(waiting.reply_to).toEqual(quote);
    await ob.flushChatOutbox();
    expect(send).toHaveBeenLastCalledWith(9, 'الإجابة', 7);
  });

  it('discard removes a queued message without sending it', async () => {
    const ob = require('../outbox') as typeof import('../outbox');
    send.mockRejectedValue(new Error('Network Error'));
    const key = ob.enqueueChatMessage({ courseId: 9, body: 'gone', sender });
    await ob.flushChatOutbox();
    ob.discardChatOutbox(key);
    expect(ob.outboxCount(9)).toBe(0);
  });
});
