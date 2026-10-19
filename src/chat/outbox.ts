import { create } from 'zustand';
import { sendChatMessage, uploadChatAttachment, type ChatReplyRef, type ChatSender } from '@/api/chat';
import { getQueryClient } from '@/lib/queryClientRef';
import { CHAT_FLAG, mergeChatMessage } from '@/hooks/useChat';
import { useOfflineStore } from '@/stores/offlineStore';
import { getFriendlyErrorMessage } from '@/utils/errors';
import {
  afterRestart, classifyError, durableFileName, enqueueItem, nextToSend, removeItem, setItemStatus,
  type OutboxAttachment, type OutboxItem,
} from '@/chat/outboxCore';

/**
 * The chat outbox: what you sent that the server does not have yet — kept ON DISK and sent
 * by itself when it can be (see outboxCore.ts for the rules).
 *
 * Storage is the same SQLite key-value store the query cache uses: one JSON blob under one
 * key, written after every change. A picked photo, document or voice clip is COPIED into the
 * app's documents folder first, named by the item's key: the picker's file lives in a cache
 * the OS may clear, and a queued message that lost its file overnight would fail for no
 * reason the person can see.
 *
 * Sending is single-flight and in order. It is kicked by every enqueue, by a retry, by the
 * room opening, by the app coming to the front, and by the phone finding a network again.
 */
interface ChatOutboxState {
  items: OutboxItem[];
  hydrated: boolean;
  /** True while a pass is on the wire — the room shows it, nothing else needs it. */
  flushing: boolean;
}


/** This session's sends: server id ↔ the outbox key the bubble had while it was waiting. */
const sentAs = new Map<number, string>();
const sentKeys = new Map<string, number>();
function rememberSent(serverId: number, localKey: string): void {
  sentAs.set(serverId, localKey);
  sentKeys.set(localKey, serverId);
}
/** The row key a server message was shown under while it was still being sent, if any. */
export function localKeyOf(serverId: number): string | undefined {
  return sentAs.get(serverId);
}
/** The server message a waiting bubble became, once it has. */
export function serverIdOf(localKey: string): number | undefined {
  return sentKeys.get(localKey);
}
export const useChatOutbox = create<ChatOutboxState>(() => ({ items: [], hydrated: false, flushing: false }));

const STORAGE_KEY = 'chat-outbox-v1';
const OUTBOX_DIR = 'chat-outbox';

// ── Storage (lazy: the native stores never load in tests or the headless task) ──────────

type Kv = { getItemAsync(k: string): Promise<string | null>; setItemAsync(k: string, v: string): Promise<void> };
let kv: Kv | null | undefined;
function storage(): Kv | null {
  if (kv !== undefined) return kv;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SQLiteStorage } = require('expo-sqlite/kv-store') as { SQLiteStorage: new (name: string) => Kv };
    kv = new SQLiteStorage('chat-outbox');
  } catch {
    kv = null;
  }
  return kv;
}

let hydrating: Promise<void> | null = null;
export function hydrateChatOutbox(): Promise<void> {
  if (useChatOutbox.getState().hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = (async () => {
    let items: OutboxItem[] = [];
    try {
      const raw = await storage()?.getItemAsync(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) items = afterRestart(parsed as OutboxItem[]);
      }
    } catch {
      // A torn blob is not worth a crash: start empty.
    }
    // Something written while the disk was being read (a send on a cold open) comes first in
    // time but after in the array — keep both, disk first.
    const already = useChatOutbox.getState().items;
    useChatOutbox.setState({ items: [...items, ...already.filter((a) => !items.some((d) => d.key === a.key))], hydrated: true });
  })();
  return hydrating;
}

function persist(): void {
  const { items } = useChatOutbox.getState();
  storage()?.setItemAsync(STORAGE_KEY, JSON.stringify(items)).catch(() => undefined);
}

function update(fn: (items: OutboxItem[]) => OutboxItem[]): void {
  useChatOutbox.setState((s) => ({ items: fn(s.items) }));
  persist();
}

// ── Files ────────────────────────────────────────────────────────────────────────────────

/** Copy the picked file into the outbox folder; on any failure the original uri is kept. */
function keepFile(key: string, att: OutboxAttachment): OutboxAttachment {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File, Directory, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const dir = new Directory(Paths.document, OUTBOX_DIR);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, durableFileName(key, att.name));
    if (dest.exists) dest.delete();
    new File(att.uri).copy(dest);
    return { ...att, uri: dest.uri };
  } catch {
    return att;
  }
}

function forgetFile(item: OutboxItem): void {
  if (!item.attachment?.uri.includes(`/${OUTBOX_DIR}/`)) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    const f = new File(item.attachment.uri);
    if (f.exists) f.delete();
  } catch { /* best effort */ }
}

// ── Public API ───────────────────────────────────────────────────────────────────────────

let seq = 0;
const newKey = () => `ob-${Date.now().toString(36)}-${(++seq).toString(36)}`;

/** Queue a text or an attachment for a room, and try to send at once. */
export function enqueueChatMessage(input: { courseId: number; body: string | null; attachment?: OutboxAttachment | null; sender: ChatSender; replyTo?: ChatReplyRef | null }): string {
  const key = newKey();
  const attachment = input.attachment ? keepFile(key, input.attachment) : null;
  update((items) => enqueueItem(items, {
    key, courseId: input.courseId, body: input.body, attachment, sender: input.sender,
    created_at: new Date().toISOString(), status: 'queued', error: null, attempts: 0,
    parentId: input.replyTo?.id ?? null, replyTo: input.replyTo ?? null,
  }));
  void flushChatOutbox();
  return key;
}

/** The person tapped «إعادة المحاولة» on a refused message. */
export function retryChatOutbox(key: string): void {
  update((items) => setItemStatus(items, key, 'queued'));
  void flushChatOutbox();
}

/** The person let a message go. Its file goes with it. */
export function discardChatOutbox(key: string): void {
  const item = useChatOutbox.getState().items.find((x) => x.key === key);
  if (item) forgetFile(item);
  update((items) => removeItem(items, key));
}

/** How many of this room's (or all) messages are still waiting. */
export function outboxCount(courseId?: number): number {
  return useChatOutbox.getState().items.filter((x) => courseId == null || x.courseId === courseId).length;
}

let flushing: Promise<void> | null = null;
/**
 * Send what is queued, oldest first, one at a time. Stops at the first NETWORK failure (the
 * rest would fail the same way) and carries on past a server refusal (the next message may
 * well be fine). Single-flight: a second call while one runs just joins it.
 */
export function flushChatOutbox(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    await hydrateChatOutbox();
    useChatOutbox.setState({ flushing: true });
    try {
      for (;;) {
        const item = nextToSend(useChatOutbox.getState().items);
        if (!item) break;
        update((items) => setItemStatus(items, item.key, 'sending'));
        try {
          const message = item.attachment
            ? await uploadChatAttachment(item.courseId, { ...item.attachment, body: item.body ?? undefined, parentId: item.parentId ?? null })
            : await sendChatMessage(item.courseId, item.body ?? '', item.parentId ?? null);
          forgetFile(item);
          // The bubble keeps its identity: the room keys the server's copy with the local key,
          // and the copy lands BEFORE the local one leaves — no frame without the message, no
          // remove-then-add at the newest row (that made the inverted list jump to the oldest
          // message on every send, founder 2026-10-15).
          rememberSent(message.id, item.key);
          const qc = getQueryClient();
          if (qc) {
            mergeChatMessage(qc, item.courseId, message);
            qc.invalidateQueries({ queryKey: ['chat', 'channels'] });
          }
          update((items) => removeItem(items, item.key));
        } catch (err) {
          if (classifyError(err) === 'network') {
            update((items) => setItemStatus(items, item.key, 'queued'));
            break;
          }
          update((items) => setItemStatus(items, item.key, 'failed', getFriendlyErrorMessage(err)));
        }
      }
    } finally {
      useChatOutbox.setState({ flushing: false });
      flushing = null;
    }
  })();
  return flushing;
}

let started = false;

/**
 * Only when chat is on for this person: the flush opens the outbox's own SQLite store, and
 * it ran on every launch and every return for everyone, chat or not (2026-10-19 staging
 * audit). A message sent while chat is on still flushes from the send itself.
 */
function flushIfChatOn(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAppConfigStore } = require('@/stores/appConfigStore') as typeof import('@/stores/appConfigStore');
    if (!useAppConfigStore.getState().config.feature_flags?.[CHAT_FLAG]) return;
  } catch {
    return;
  }
  void flushChatOutbox();
}

/**
 * Wire the triggers once per app run: a network that comes back, the app returning to the
 * front. Both roles chat, so this lives in the root layout — not in the teacher's.
 */
export function startChatOutbox(): void {
  if (started) return;
  started = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const NetInfo = (require('@react-native-community/netinfo') as typeof import('@react-native-community/netinfo')).default;
    // Its OWN memory of the last state: reading (and writing) the shared flag first made the
    // teacher layout's listener — called after this one — see «already online» and skip the
    // offline-scan upload on reconnect (audit 2026-10-17). The flag itself is still kept true to
    // life here for the student and parent apps, which have no other listener.
    let was = useOfflineStore.getState().online;
    NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      const came = online && !was;
      was = online;
      const role = require('@/stores/authStore').useAuthStore.getState().role as string | null;
      if (role !== 'teacher' && role !== 'assistant') {
        useOfflineStore.getState().setOnline(online, state.type === 'wifi' ? 'wifi' : state.type === 'cellular' ? 'cellular' : 'other');
      }
      if (came) flushIfChatOn();
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppState } = require('react-native') as typeof import('react-native');
    AppState.addEventListener('change', (s) => { if (s === 'active') flushIfChatOn(); });
  } catch {
    // Headless or test: nothing to wire.
  }
  flushIfChatOn();
}
