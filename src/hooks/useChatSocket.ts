import { useMemo } from 'react';
import type { ChatMessage, ChatRealtime } from '@/api/chat';
import { useRealtimeChannels, type RealtimeStatus } from '@/hooks/useRealtimeChannels';

/**
 * A live subscription to one room's private channel, when the server says a broadcaster is
 * configured (`realtime` non-null). The transport lives in `useRealtimeChannels`; this is
 * the room's vocabulary on top of it: a posted message, a hidden one, and someone typing.
 */
export function useChatSocket(
  courseId: number,
  realtime: ChatRealtime | null | undefined,
  handlers: {
    onMessage: (m: ChatMessage) => void;
    onHidden: (id: number) => void;
    /** Somebody in the room is typing right now — the sender's own frames included. */
    onTyping?: (t: { user_id: number; name: string }) => void;
  },
  enabled = true,
): { connected: boolean; status: ChatSocketStatus } {
  const channels = useMemo(
    () => (realtime?.channel_prefix && courseId > 0 ? [`${realtime.channel_prefix}${courseId}`] : []),
    [realtime?.channel_prefix, courseId],
  );
  return useRealtimeChannels(realtime, channels, {
    'message.posted': (d: { message?: ChatMessage }) => { if (d?.message) handlers.onMessage(d.message); },
    'message.hidden': (d: { id?: number }) => { if (d?.id) handlers.onHidden(d.id); },
    'typing': (d: { user_id?: number; name?: string }) => { if (d?.user_id && handlers.onTyping) handlers.onTyping({ user_id: d.user_id, name: d.name ?? '' }); },
  }, enabled);
}

export type ChatSocketStatus = RealtimeStatus;
