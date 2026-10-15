import { useMemo } from 'react';
import type { ChatMessage, ChatReaction, ChatRealtime } from '@/api/chat';
import { useRealtimeChannels, type RealtimeStatus } from '@/hooks/useRealtimeChannels';
import { roomSocketChannel } from '@/chat/room';

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
    /** A member's read cursor moved — the «seen» ticks can turn without a poll. */
    onRead?: (r: { user_id: number; last_read_message_id: number }) => void;
    /** A message's reactions changed: the whole new summary for that message. */
    onReaction?: (r: { message_id: number; reactions: ChatReaction[] }) => void;
  },
  enabled = true,
): { connected: boolean; status: ChatSocketStatus; detail: string } {
  const channels = useMemo(
    // A room id: the course for the students' room, minus it for the parents' room.
    () => (realtime?.channel_prefix && courseId !== 0 ? [roomSocketChannel(courseId, realtime.channel_prefix)] : []),
    [realtime?.channel_prefix, courseId],
  );
  return useRealtimeChannels(realtime, channels, {
    'message.posted': (d: { message?: ChatMessage }) => { if (d?.message) handlers.onMessage(d.message); },
    'message.hidden': (d: { id?: number }) => { if (d?.id) handlers.onHidden(d.id); },
    'typing': (d: { user_id?: number; name?: string }) => { if (d?.user_id && handlers.onTyping) handlers.onTyping({ user_id: d.user_id, name: d.name ?? '' }); },
    'reaction': (d: { message_id?: number; reactions?: ChatReaction[] }) => { if (d?.message_id && handlers.onReaction) handlers.onReaction({ message_id: d.message_id, reactions: d.reactions ?? [] }); },
    'read': (d: { user_id?: number; last_read_message_id?: number }) => { if (d?.user_id && d.last_read_message_id && handlers.onRead) handlers.onRead({ user_id: d.user_id, last_read_message_id: d.last_read_message_id }); },
  }, enabled);
}

export type ChatSocketStatus = RealtimeStatus;
