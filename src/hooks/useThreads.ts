import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useRealtimeChannels } from '@/hooks/useRealtimeChannels';
import type { ChatRealtime } from '@/api/chat';
import {
  answerThread, commentOnThread, createThread, extendThread, getThread, getThreadReports, getThreadVideoAudience,
  getThreadsFeed, getThreadsUnread, hideThreadComment, lockThread, pickThreadComment, reportThreadComment,
  resolveThreadReport, updateThreadSettings, uploadThreadVideo, voteThreadComment, withdrawThread,
  type ComposeThreadInput, type ThreadComment, type ThreadDetail, type ThreadSettings,
} from '@/api/threads';

export const THREADS_FLAG = 'threads';
const DEFAULT_POLL_MS = 15000;

/** True only when the super-admin has switched threads on. Everything threads hangs off this. */
export function useThreadsEnabled(): boolean {
  const { data: flags } = useFeatureFlags();
  return !!flags?.[THREADS_FLAG];
}

/**
 * The feed; shares its key with the tab badge so a pull-to-refresh refreshes both. With a
 * live channel (`live`) the poll is only a safety net — the socket frame is what refreshes
 * it (founder, 2026-09-20: a student saw the teacher's post a minute late).
 */
export function useThreadsFeed(enabled = true, live = false) {
  const on = useThreadsEnabled();
  return useQuery({
    queryKey: ['threads', 'feed'],
    queryFn: () => getThreadsFeed(),
    enabled: on && enabled,
    staleTime: 15_000,
    refetchInterval: live ? 5 * 60_000 : 60_000,
    refetchIntervalInBackground: false,
  });
}

/**
 * The grade channels' frames → the caches. A frame names WHICH thread changed and nothing
 * else; the screens refetch over REST, which re-authorises the reader. Returns the socket's
 * real state so the callers can slow their polls only once the channels are subscribed.
 */
export function useThreadsRealtime(realtime: ChatRealtime | null | undefined, channels: readonly string[], enabled = true) {
  const qc = useQueryClient();
  return useRealtimeChannels(realtime, channels, {
    'thread.changed': (d: { thread_id?: number; change?: string }) => {
      qc.invalidateQueries({ queryKey: ['threads', 'feed'] });
      qc.invalidateQueries({ queryKey: ['threads', 'unread'] });
      if (d?.thread_id) qc.invalidateQueries({ queryKey: ['threads', 'one', d.thread_id] });
    },
  }, enabled);
}

/** The badge, on its own light endpoint. */
export function useThreadsUnread(enabled = true) {
  const on = useThreadsEnabled();
  return useQuery({
    queryKey: ['threads', 'unread'],
    queryFn: getThreadsUnread,
    enabled: on && enabled,
    staleTime: 20_000,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
  });
}

/**
 * One thread with its comments, polled while the screen is focused — the timer and the votes
 * move. Two cadences come from the server and the socket's real state picks one.
 */
export function useThread(id: number, active: boolean, live = false) {
  const on = useThreadsEnabled();
  return useQuery({
    queryKey: ['threads', 'one', id],
    queryFn: () => getThread(id),
    enabled: on && id > 0,
    refetchInterval: (query) => {
      if (!active) return false;
      const limits = query.state.data?.limits;
      return live ? (limits?.poll_ms_socket || 60_000) : (limits?.poll_ms || DEFAULT_POLL_MS);
    },
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}

function useInvalidateThreads() {
  const qc = useQueryClient();
  return (id?: number) => {
    qc.invalidateQueries({ queryKey: ['threads', 'feed'] });
    qc.invalidateQueries({ queryKey: ['threads', 'unread'] });
    if (id) qc.invalidateQueries({ queryKey: ['threads', 'one', id] });
  };
}

/** Replace one comment in the cached detail — the optimistic half of a vote. */
export function patchThreadComment(qc: ReturnType<typeof useQueryClient>, threadId: number, comment: ThreadComment): void {
  qc.setQueryData<ThreadDetail>(['threads', 'one', threadId], (d) =>
    d ? { ...d, comments: d.comments.map((c) => (c.id === comment.id ? comment : c)) } : d,
  );
}

export function useCreateThread() {
  const invalidate = useInvalidateThreads();
  return useMutation({ mutationFn: (input: ComposeThreadInput) => createThread(input), onSuccess: () => invalidate() });
}

export function useAnswerThread(id: number) {
  const invalidate = useInvalidateThreads();
  return useMutation({ mutationFn: (input: { body?: string; video_id?: number | null }) => answerThread(id, input), onSuccess: () => invalidate(id) });
}

export function useLockThread(id: number) {
  const invalidate = useInvalidateThreads();
  return useMutation({ mutationFn: () => lockThread(id), onSuccess: () => invalidate(id) });
}

export function useExtendThread(id: number) {
  const invalidate = useInvalidateThreads();
  return useMutation({ mutationFn: (minutes: number | null) => extendThread(id, minutes), onSuccess: () => invalidate(id) });
}

export function useWithdrawThread() {
  const invalidate = useInvalidateThreads();
  return useMutation({ mutationFn: (id: number) => withdrawThread(id), onSuccess: () => invalidate() });
}

export function useCommentOnThread(id: number) {
  const invalidate = useInvalidateThreads();
  return useMutation({ mutationFn: (body: string) => commentOnThread(id, body), onSuccess: () => invalidate(id) });
}

export function useHideThreadComment(threadId: number) {
  const invalidate = useInvalidateThreads();
  return useMutation({
    mutationFn: (input: { commentId: number; reason?: string }) => hideThreadComment(input.commentId, input.reason),
    onSuccess: () => invalidate(threadId),
  });
}

/** A vote is optimistic: the score moves under the finger; the server's row replaces it. */
export function useVoteThreadComment(threadId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { commentId: number; value: -1 | 0 | 1 }) => voteThreadComment(input.commentId, input.value),
    onMutate: (input) => {
      const prev = qc.getQueryData<ThreadDetail>(['threads', 'one', threadId]);
      const current = prev?.comments.find((c) => c.id === input.commentId);
      if (prev && current) {
        const up = current.up - (current.my_vote === 1 ? 1 : 0) + (input.value === 1 ? 1 : 0);
        const down = current.down - (current.my_vote === -1 ? 1 : 0) + (input.value === -1 ? 1 : 0);
        patchThreadComment(qc, threadId, { ...current, up, down, score: up - down, my_vote: input.value });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['threads', 'one', threadId], ctx.prev); },
    onSuccess: (comment) => patchThreadComment(qc, threadId, comment),
  });
}

export function usePickThreadComment(threadId: number) {
  const invalidate = useInvalidateThreads();
  return useMutation({
    mutationFn: (input: { commentId: number; picked: boolean }) => pickThreadComment(input.commentId, input.picked),
    onSuccess: () => invalidate(threadId),
  });
}

export function useReportThreadComment() {
  return useMutation({ mutationFn: (input: { commentId: number; reason: string; note?: string }) => reportThreadComment(input.commentId, input.reason, input.note) });
}

export function useUpdateThreadSettings() {
  const invalidate = useInvalidateThreads();
  return useMutation({ mutationFn: (input: Partial<ThreadSettings>) => updateThreadSettings(input), onSuccess: () => invalidate() });
}

export function useUploadThreadVideo() {
  return useMutation({ mutationFn: uploadThreadVideo });
}

export function useThreadReports(enabled: boolean) {
  const on = useThreadsEnabled();
  return useQuery({ queryKey: ['threads', 'reports'], queryFn: getThreadReports, enabled: on && enabled, refetchInterval: 30_000, refetchIntervalInBackground: false });
}

export function useResolveThreadReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reportId: number; action: 'dismiss' | 'remove' }) => resolveThreadReport(input.reportId, input.action),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['threads'] }); },
  });
}

export function useThreadVideoAudience(videoId: number | null, enabled: boolean) {
  const on = useThreadsEnabled();
  return useQuery({
    queryKey: ['threads', 'audience', videoId],
    queryFn: () => getThreadVideoAudience(videoId as number),
    enabled: on && enabled && !!videoId,
    staleTime: 10_000,
  });
}
