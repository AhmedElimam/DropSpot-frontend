import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useChatEnabled } from '@/hooks/useChat';
import { useThreadsEnabled } from '@/hooks/useThreads';
import type { ChatChannelSummary } from '@/api/chat';
import { useInAppNotice } from './inAppNotice';

const CHANNELS_KEY = JSON.stringify(['chat', 'channels']);
const THREADS_KEY = JSON.stringify(['threads', 'unread']);
/** A room's newest message is toasted only when it is this fresh — never an old unread one after a cold start. */
const FRESH_MS = 3 * 60 * 1000;

type Seen = Record<string, { unread: number; at: number }>;
const roomKey = (c: ChatChannelSummary) => `${c.audience === 'parents' ? '-' : ''}${c.course_id}`;

/**
 * Chat and حكاوي reach the in-app toast and the bell (founder 2026-10-27: «forwarding the
 * incoming messaging and in-app notification»). A chat message creates no notification row
 * and its push goes straight to FCM, so the generic host hears it only as a foreground push.
 * Here the conversations list the home already polls (every 30 s) is the second ear: a room
 * whose unread count rose with a fresh message from someone else is toasted with its sender
 * and preview, and tapping it opens that room. A new حكاية only rings the bell (no preview).
 * The first snapshot after sign-in is a baseline, never toasted. Off entirely with the flags.
 */
export function ChatNoticeBridge() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const chatOn = useChatEnabled();
  const threadsOn = useThreadsEnabled();
  const qc = useQueryClient();
  const seen = useRef<Seen | null>(null);
  const threadsSeen = useRef<number | null>(null);

  useEffect(() => {
    seen.current = null;
    threadsSeen.current = null;
    if (!isAuthenticated || (!chatOn && !threadsOn)) return;
    const cache = qc.getQueryCache();
    return cache.subscribe((e) => {
      if (e.type !== 'updated' || e.action.type !== 'success' || (e.action as { manual?: boolean }).manual) return;
      const key = JSON.stringify(e.query.queryKey);

      if (key === THREADS_KEY && threadsOn) {
        const n = typeof e.action.data === 'number' ? e.action.data : null;
        if (n === null) return;
        const prev = threadsSeen.current;
        threadsSeen.current = n;
        if (prev !== null && n > prev) useInAppNotice.getState().pulse();
        return;
      }

      if (key !== CHANNELS_KEY || !chatOn) return;
      const rows = Array.isArray(e.action.data) ? (e.action.data as ChatChannelSummary[]) : null;
      if (!rows) return;
      const next: Seen = {};
      for (const c of rows) next[roomKey(c)] = { unread: c.unread || 0, at: c.last_message_at ? Date.parse(c.last_message_at) || 0 : 0 };
      const prev = seen.current;
      seen.current = next;
      if (!prev) return; // the baseline
      // The newest room that gained unread messages since the last look, from someone else.
      const fresh = rows
        .filter((c) => {
          const k = roomKey(c); const was = prev[k];
          return (c.unread || 0) > (was?.unread ?? 0) && next[k].at > (was?.at ?? 0) && !c.last_mine && Date.now() - next[k].at <= FRESH_MS;
        })
        .sort((a, b) => next[roomKey(b)].at - next[roomKey(a)].at);
      const top = fresh[0];
      if (!top) return;
      const title = (top.audience === 'parents' ? 'أولياء أمور · ' : '') + (top.course_name ?? 'دردشة المقرر');
      const body = [top.last_sender, top.last_preview].filter(Boolean).join(': ');
      useInAppNotice.getState().show({
        id: null, title, body, type: 'chat_message',
        data: { course_id: String(top.course_id), room: top.audience ?? 'students', type: 'chat_message' },
      });
    });
  }, [isAuthenticated, userId, chatOn, threadsOn, qc]);

  return null;
}
