import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import {
  blockChatUser, deleteChatMessage, getChatChannels, getChatReports, getChatRoom, muteChatUser,
  reportChatMessage, resolveChatReport, sendChatMessage, setChatNotify, setChatSettings,
  uploadChatAttachment,
  type ChatAttachmentKind, type ChatMessage, type ChatReportAction, type ChatRoom,
} from '@/api/chat';

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
export function useChatRoom(courseId: number, active: boolean, live = false) {
  const on = useChatEnabled();
  return useQuery({
    queryKey: ['chat', 'room', courseId],
    queryFn: () => getChatRoom(courseId),
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
  return useMutation({
    mutationFn: (input: { kind: ChatAttachmentKind; uri: string; name: string; mime: string; duration?: number; body?: string }) =>
      uploadChatAttachment(courseId, input),
    onSuccess: (message) => {
      mergeChatMessage(qc, courseId, message);
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] });
    },
  });
}

export function useSendChatMessage(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendChatMessage(courseId, body),
    onSuccess: (message) => {
      // Show it at once rather than waiting for the next poll or the socket echo.
      mergeChatMessage(qc, courseId, message);
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] });
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
    },
  });
}

export function useSetChatNotify(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notify: boolean) => setChatNotify(courseId, notify),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'channels'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'room', courseId] }),
  });
}

export function useSetChatSettings(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: { is_locked?: boolean; announcements_only?: boolean }) => setChatSettings(courseId, settings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'room', courseId] });
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] });
    },
  });
}
