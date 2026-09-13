import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import {
  blockChatUser, deleteChatMessage, getChatChannels, getChatRoom, reportChatMessage,
  sendChatMessage, setChatNotify, uploadChatAttachment, type ChatAttachmentKind, type ChatMessage, type ChatRoom,
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
 * The latest page of a room, polled while the screen is focused (`active`). The interval
 * comes from the server: short when polling IS the transport, long when a socket carries
 * the messages and the poll is only the safety net.
 */
export function useChatRoom(courseId: number, active: boolean) {
  const on = useChatEnabled();
  return useQuery({
    queryKey: ['chat', 'room', courseId],
    queryFn: () => getChatRoom(courseId),
    enabled: on && courseId > 0,
    refetchInterval: (query) => (active ? (query.state.data?.limits?.poll_ms || CHAT_POLL_MS) : false),
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
