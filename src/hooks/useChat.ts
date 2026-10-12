import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import {
  blockChatUser, deleteChatMessage, getChatCalendar, getChatChannels, getChatInfo, getChatMedia, getChatReports, getChatRoom, muteChatUser,
  reportChatMessage, resolveChatReport, sendChatMessage, setChatNotify, setChatSettings, unblockChatUser, unmuteChatUser,
  uploadChatAttachment, type ChatMediaType,
  type ChatAttachmentKind, type ChatMessage, type ChatReportAction, type ChatRoom, type ChatSender,
} from '@/api/chat';
import { useAuthStore } from '@/stores/authStore';
import { applyRecentHidden, lastServerId, mergeTail } from '@/chat/roomView';

export const CHAT_FLAG = 'course_chat';

/** How often an open room asks for new messages. No socket — FCM wakes the app, REST fills it. */
export const CHAT_POLL_MS = 8000;

/** True only when the super-admin has switched course chat on. Everything chat hangs off this. */
export function useChatEnabled(): boolean {
  const { data: flags } = useFeatureFlags();
  return !!flags?.[CHAT_FLAG];
}

export function useChatChannels(enabled = true) {
  const on = useChatEnabled();
  return useQuery({
    queryKey: ['chat', 'channels'],
    queryFn: getChatChannels,
    enabled: on && enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

/**
 * The latest page of a room, polled while the screen is focused (`active`). Two cadences come
 * from the server and the SOCKET'S real state picks one: the fast one is the transport until
 * the private channel is subscribed (`live`) — and again the moment it drops; the slow one is
 * only a safety net behind a working socket. Picking by "is a broadcaster configured" left a
 * phone that could not reach it on a 45-second poll with nothing to say why.
 */
/** A full page every so often, whatever the poll says — the safety net under the deltas. */
export const CHAT_FULL_REFRESH_MS = 120_000;
const lastFull = new Map<number, number>();

/**
 * One poll of a room. The first call (and one every two minutes) fetches the latest page;
 * every other call asks only for what is NEWER than the last message held, so an idle room
 * costs an empty answer instead of the last fifty messages again (founder 2026-10-12 —
 * the poll was 25 queries and 14 KB every 8 seconds). An older server that ignores
 * `after_id` answers with a full page, which is used as is.
 */
export async function pollChatRoom(courseId: number, prev: ChatRoom | undefined, now: number = Date.now()): Promise<ChatRoom> {
  const lastId = prev ? lastServerId(prev.messages) : 0;
  const due = now - (lastFull.get(courseId) ?? 0) > CHAT_FULL_REFRESH_MS;
  const full = async () => { const page = await getChatRoom(courseId); lastFull.set(courseId, now); return page; };
  if (!prev || !lastId || due) return full();

  const fresh = await getChatRoom(courseId, { afterId: lastId });
  if (fresh.window?.mode !== 'after') { lastFull.set(courseId, now); return fresh; }
  if (fresh.window.has_more_after) return full(); // away too long: start from the latest page
  const moderator = fresh.role === 'teacher' || fresh.role === 'assistant';
  const hidden = applyRecentHidden(prev.messages, fresh.recent_hidden_ids, moderator);
  if (hidden.refetch) return full();
  return { ...fresh, messages: mergeTail(hidden.messages, fresh.messages) };
}

export function useChatRoom(courseId: number, active: boolean, live = false) {
  const on = useChatEnabled();
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['chat', 'room', courseId],
    queryFn: () => pollChatRoom(courseId, qc.getQueryData<ChatRoom>(['chat', 'room', courseId])),
    enabled: on && courseId > 0,
    refetchInterval: (query) => {
      if (!active) return false;
      const limits = query.state.data?.limits;
      return (live ? limits?.poll_ms : limits?.poll_ms_fallback) || CHAT_POLL_MS;
    },
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}

/** Merge a message that arrived by socket (or by our own send) into the room cache — once. */
export function mergeChatMessage(qc: ReturnType<typeof useQueryClient>, courseId: number, message: ChatMessage): void {
  qc.setQueryData<ChatRoom>(['chat', 'room', courseId], (room) => {
    if (!room || room.messages.some((m) => m.id === message.id)) return room;
    if (room.blocked_user_ids?.includes(message.sender.id)) return room; // §4 — hidden from MY view
    return { ...room, messages: [...room.messages, message] };
  });
}

export function dropChatMessage(qc: ReturnType<typeof useQueryClient>, courseId: number, messageId: number): void {
  qc.setQueryData<ChatRoom>(['chat', 'room', courseId], (room) =>
    room ? { ...room, messages: room.messages.filter((m) => m.id !== messageId) } : room,
  );
}

export function useUploadChatAttachment(courseId: number) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const roomKey = ['chat', 'room', courseId] as const;
  return useMutation({
    mutationFn: (input: { kind: ChatAttachmentKind; uri: string; name: string; mime: string; duration?: number; body?: string }) =>
      uploadChatAttachment(courseId, input),
    // The local file IS the preview: the photo shows from disk while it uploads, the voice
    // note is playable at once, the document shows its name — with a clock, like a text.
    onMutate: (input) => {
      const key = nextLocalKey();
      const sender = localSender(me, qc.getQueryData<ChatRoom>(roomKey)?.role);
      qc.setQueryData<ChatRoom>(roomKey, (room) => appendLocal(room, localChatMessage({
        key, sender, body: input.body ?? null,
        attachment: { kind: input.kind, name: input.name, mime: input.mime, size: null, duration: input.duration ?? null, expired: false, url: input.uri },
      })));
      return { key };
    },
    onSuccess: (message, _input, ctx) => {
      qc.setQueryData<ChatRoom>(roomKey, (room) => resolveLocal(room, ctx?.key, message));
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] });
    },
    onError: (_err, _input, ctx) => {
      qc.setQueryData<ChatRoom>(roomKey, (room) => failLocal(room, ctx?.key));
    },
  });
}

// ── Optimistic send ──────────────────────────────────────────────────────────────
// A message is on screen the instant you tap send, with a clock instead of the tick, and is
// swapped for the server's copy when the reply lands. Before this the bubble waited for the
// whole round trip — which includes the server's own ~300ms call to Pusher — and the room
// felt a beat slower than any messenger the family already uses (founder, 2026-09-20). A
// failed send STAYS on screen, marked, with a retry: nothing typed is ever silently lost.
//
// The four reducers below are pure functions over the room cache so they can be tested
// without React Query, a network, or a device.

let localSeq = 0;
const nextLocalKey = () => `local-${Date.now()}-${++localSeq}`;

/** The row for something just sent: a negative placeholder id, and `local.sending`. */
export function localChatMessage(input: { key: string; body: string | null; sender: ChatSender; attachment?: ChatMessage['attachment'] }): ChatMessage {
  return {
    id: -(++localSeq),
    parent_id: null,
    kind: input.attachment?.kind ?? 'text',
    body: input.body,
    hidden: false,
    attachment: input.attachment ?? null,
    sender: input.sender,
    created_at: new Date().toISOString(),
    local: { status: 'sending', key: input.key },
  };
}

export function appendLocal(room: ChatRoom | undefined, m: ChatMessage): ChatRoom | undefined {
  return room ? { ...room, messages: [...room.messages, m] } : room;
}

/**
 * The server answered: the optimistic row becomes the real one, IN PLACE. If the socket echo
 * already delivered the real message (it often beats the HTTP reply), the row is simply
 * dropped — the real one is never shown twice.
 */
export function resolveLocal(room: ChatRoom | undefined, key: string | undefined, real: ChatMessage): ChatRoom | undefined {
  if (!room) return room;
  const idx = room.messages.findIndex((m) => m.local?.key === key);
  const without = room.messages.filter((m) => m.local?.key !== key);
  if (without.some((m) => m.id === real.id)) return { ...room, messages: without };
  if (idx < 0) return { ...room, messages: [...without, real] };
  return { ...room, messages: [...without.slice(0, idx), real, ...without.slice(idx)] };
}

export function failLocal(room: ChatRoom | undefined, key: string | undefined): ChatRoom | undefined {
  if (!room) return room;
  return { ...room, messages: room.messages.map((m) => (m.local?.key === key ? { ...m, local: { status: 'failed' as const, key: m.local?.key ?? '' } } : m)) };
}

export function removeLocal(room: ChatRoom | undefined, key: string | undefined): ChatRoom | undefined {
  return room ? { ...room, messages: room.messages.filter((m) => m.local?.key !== key) } : room;
}

/** Discard an optimistic row (before a retry, or because the sender gave up on it). */
export function dropChatLocal(qc: ReturnType<typeof useQueryClient>, courseId: number, key: string): void {
  qc.setQueryData<ChatRoom>(['chat', 'room', courseId], (room) => removeLocal(room, key));
}

/** How the sender appears on their own optimistic bubble — the same shape the server sends. */
function localSender(user: { id: number; name: string } | null | undefined, role: ChatRoom['role'] | undefined): ChatSender {
  return {
    id: user?.id ?? -1,
    name: user?.name ?? '',
    is_staff: role === 'teacher' || role === 'assistant',
    is_teacher: role === 'teacher',
  };
}

export function useSendChatMessage(courseId: number) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const roomKey = ['chat', 'room', courseId] as const;
  return useMutation({
    mutationFn: (body: string) => sendChatMessage(courseId, body),
    onMutate: (body) => {
      const key = nextLocalKey();
      const sender = localSender(me, qc.getQueryData<ChatRoom>(roomKey)?.role);
      qc.setQueryData<ChatRoom>(roomKey, (room) => appendLocal(room, localChatMessage({ key, body, sender })));
      return { key };
    },
    onSuccess: (message, _body, ctx) => {
      qc.setQueryData<ChatRoom>(roomKey, (room) => resolveLocal(room, ctx?.key, message));
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] });
    },
    onError: (_err, _body, ctx) => {
      qc.setQueryData<ChatRoom>(roomKey, (room) => failLocal(room, ctx?.key));
    },
  });
}

export function useDeleteChatMessage(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: number) => deleteChatMessage(messageId),
    onSuccess: (_void, messageId) => {
      qc.setQueryData<ChatRoom>(['chat', 'room', courseId], (room) =>
        room ? { ...room, messages: room.messages.filter((m) => m.id !== messageId) } : room,
      );
    },
  });
}

export function useReportChatMessage() {
  return useMutation({
    mutationFn: ({ messageId, reason, note }: { messageId: number; reason: string; note?: string }) =>
      reportChatMessage(messageId, reason, note),
  });
}

export function useBlockChatUser(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => blockChatUser(courseId, userId),
    onSuccess: (_msg, userId) => {
      // Their messages vanish from MY view immediately; the server does the same on the next poll.
      qc.setQueryData<ChatRoom>(['chat', 'room', courseId], (room) =>
        room ? { ...room, messages: room.messages.filter((m) => m.sender.id !== userId) } : room,
      );
      qc.invalidateQueries({ queryKey: ['chat', 'info', courseId] });
      qc.invalidateQueries({ queryKey: ['chat', 'media', courseId] });
    },
  });
}

export function useSetChatNotify(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notify: boolean) => setChatNotify(courseId, notify),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] });
      qc.invalidateQueries({ queryKey: ['chat', 'info', courseId] });
    },
  });
}

// ── Moderation (teacher / granted assistant) ─────────────────────────────────

/** Open reports on one room. Only fetched when the viewer actually moderates it. */
export function useChatReports(courseId: number, enabled: boolean) {
  const on = useChatEnabled();
  return useQuery({
    queryKey: ['chat', 'reports', courseId],
    queryFn: () => getChatReports(courseId),
    enabled: on && enabled && courseId > 0,
    staleTime: 10_000,
    refetchInterval: enabled ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useResolveChatReport(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, ...payload }: { reportId: number; action: ChatReportAction; note?: string; hours?: number; reason?: string }) =>
      resolveChatReport(reportId, payload),
    onSuccess: () => {
      // A resolution can hide a message or mute someone — refetch both views.
      qc.invalidateQueries({ queryKey: ['chat', 'reports', courseId] });
      qc.invalidateQueries({ queryKey: ['chat', 'room', courseId] });
    },
  });
}

export function useMuteChatUser(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, hours, reason }: { userId: number; hours: number; reason: string }) =>
      muteChatUser(courseId, userId, hours, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'room', courseId] });
      qc.invalidateQueries({ queryKey: ['chat', 'info', courseId] });
    },
  });
}

export function useSetChatSettings(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: { is_locked?: boolean; announcements_only?: boolean }) => setChatSettings(courseId, settings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'room', courseId] });
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] });
      qc.invalidateQueries({ queryKey: ['chat', 'info', courseId] });
    },
  });
}


// ── The room's info page, shelf and days ─────────────────────────────────────

export function useChatInfo(courseId: number, enabled = true) {
  const on = useChatEnabled();
  return useQuery({
    queryKey: ['chat', 'info', courseId],
    queryFn: () => getChatInfo(courseId),
    enabled: on && enabled && courseId > 0,
    staleTime: 20_000,
  });
}

/** One tab of the shelf, paged newest first as the list scrolls. */
export function useChatMedia(courseId: number, type: ChatMediaType, enabled = true) {
  const on = useChatEnabled();
  return useInfiniteQuery({
    queryKey: ['chat', 'media', courseId, type],
    queryFn: ({ pageParam }) => getChatMedia(courseId, type, pageParam || undefined),
    initialPageParam: 0,
    getNextPageParam: (last) => last.next_before_id ?? undefined,
    enabled: on && enabled && courseId > 0,
    staleTime: 30_000,
  });
}

/** Messages per day between two dates (YYYY-MM-DD). */
export function useChatCalendar(courseId: number, from: string, to: string, enabled = true) {
  const on = useChatEnabled();
  return useQuery({
    queryKey: ['chat', 'calendar', courseId, from, to],
    queryFn: () => getChatCalendar(courseId, from, to),
    enabled: on && enabled && courseId > 0 && !!from && !!to,
    staleTime: 60_000,
  });
}

export function useUnmuteChatUser(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (muteId: number) => unmuteChatUser(muteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'info', courseId] });
      qc.invalidateQueries({ queryKey: ['chat', 'room', courseId] });
    },
  });
}

export function useUnblockChatUser(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => unblockChatUser(userId),
    onSuccess: () => {
      lastFull.delete(courseId); // their messages come back on the next full page
      qc.invalidateQueries({ queryKey: ['chat', 'info', courseId] });
      qc.invalidateQueries({ queryKey: ['chat', 'room', courseId] });
      qc.invalidateQueries({ queryKey: ['chat', 'media', courseId] });
    },
  });
}
