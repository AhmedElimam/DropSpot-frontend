import type { ChatAttachmentKind, ChatMessage, ChatSender } from '@/api/chat';

/**
 * The chat outbox, as pure data — the part that can be tested without a phone.
 *
 * A message you send goes HERE first, on disk, and leaves only once the server has it. The
 * room draws the outbox after the server's messages, so a message is on screen the instant
 * you tap send and STAYS there: through the next poll (which used to replace the list and
 * drop the optimistic bubble — «fail to send removes that failed message», founder
 * 2026-10-12), through a dead network, through the app being closed. When the connection
 * is back the outbox sends itself, oldest first, like any messenger.
 *
 * Three states:
 *  - `queued`  — waiting for its turn, or for a connection;
 *  - `sending` — on the wire right now;
 *  - `failed`  — the SERVER refused it (muted, locked, too big…). A refusal is final until
 *                the person taps retry: nothing is re-sent on its own that was refused.
 * A network error is never `failed`: the item goes back to `queued` and waits.
 */
export type OutboxStatus = 'queued' | 'sending' | 'failed';

export interface OutboxAttachment {
  kind: ChatAttachmentKind;
  /** A local file: the picker's copy, or the outbox's own durable copy (see outbox.ts). */
  uri: string;
  name: string;
  mime: string;
  duration?: number;
}

export interface OutboxItem {
  key: string;
  courseId: number;
  body: string | null;
  attachment: OutboxAttachment | null;
  sender: ChatSender;
  created_at: string;
  status: OutboxStatus;
  error: string | null;
  attempts: number;
}

export function enqueueItem(items: OutboxItem[], item: OutboxItem): OutboxItem[] {
  return items.some((x) => x.key === item.key) ? items : [...items, item];
}

export function setItemStatus(items: OutboxItem[], key: string, status: OutboxStatus, error: string | null = null): OutboxItem[] {
  return items.map((x) => (x.key === key ? { ...x, status, error, attempts: status === 'sending' ? x.attempts + 1 : x.attempts } : x));
}

export function removeItem(items: OutboxItem[], key: string): OutboxItem[] {
  return items.filter((x) => x.key !== key);
}

/** Oldest queued item — or nothing while one is already on the wire (one at a time, in order). */
export function nextToSend(items: OutboxItem[]): OutboxItem | null {
  if (items.some((x) => x.status === 'sending')) return null;
  return items.find((x) => x.status === 'queued') ?? null;
}

/** After a restart nothing is on the wire any more: whatever was `sending` is queued again. */
export function afterRestart(items: OutboxItem[]): OutboxItem[] {
  return items.map((x) => (x.status === 'sending' ? { ...x, status: 'queued' as const } : x));
}

/** The outbox row drawn as a message: a negative placeholder id and the `local` marker. */
export function outboxToMessage(item: OutboxItem, index: number): ChatMessage {
  return {
    id: -(index + 1),
    parent_id: null,
    kind: item.attachment?.kind ?? 'text',
    body: item.body,
    hidden: false,
    attachment: item.attachment
      ? { kind: item.attachment.kind, name: item.attachment.name, mime: item.attachment.mime, size: null, duration: item.attachment.duration ?? null, expired: false, url: item.attachment.uri }
      : null,
    sender: item.sender,
    created_at: item.created_at,
    local: { status: item.status, key: item.key },
  };
}

/** The room's list: the server's messages, then this room's outbox in the order it was written. */
export function mergeOutbox(messages: ChatMessage[], items: OutboxItem[], courseId: number): ChatMessage[] {
  const mine = items.filter((x) => x.courseId === courseId);
  if (!mine.length) return messages;
  return [...messages, ...mine.map((x, i) => outboxToMessage(x, i))];
}

/**
 * Did the network drop it, or did the server refuse it? No response at all (offline, DNS,
 * timeout) is the network's fault and the item waits; a status code is the server's word.
 * A 5xx is treated as transient too — a server mid-deploy is not a refusal.
 */
export function classifyError(err: unknown): 'network' | 'rejected' {
  const e = err as { response?: { status?: number }; code?: string } | null;
  const status = e?.response?.status;
  if (!status) return 'network';
  if (status >= 500) return 'network';
  return 'rejected';
}

/** The outbox's own copy of a file, named by the item key so it can never collide. */
export function durableFileName(key: string, originalName: string): string {
  const ext = (originalName.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  return `${key}.${ext}`;
}
