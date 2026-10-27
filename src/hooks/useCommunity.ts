import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import {
  commentOnCommunityPost, createCommunityPost, deleteCommunityComment, deleteCommunityPost, editCommunityPost, getCommunityFeed,
  getCommunityPost, getCommunityQueue, getCommunitySettings, getCommunitySpaces, getCommunityUnread, moderateCommunityComment,
  moderateCommunityPost, reactToCommunityPost, reportCommunityComment, reportCommunityPost, resolveCommunityReport, updateCommunitySettings,
  uploadCommunityMedia,
  type CommentModeration, type CommunityAudience, type CommunityFilter, type CommunityPost, type CommunityReaction, type CommunitySettings,
  type CreatePostInput, type PostModeration, type ReportResolution, type UploadMediaInput,
} from '@/api/community';

export const COMMUNITY_FLAG = 'community';

/** True only when the server switched the community on for this person. Everything hangs off this. */
export function useCommunityEnabled(): boolean {
  const { data: flags } = useFeatureFlags();
  return !!flags?.[COMMUNITY_FLAG];
}

const KEY = ['community'] as const;

/** The spaces this person reads (one per teacher per audience) with unread / held counts. */
export function useCommunitySpaces(enabled = true) {
  const on = useCommunityEnabled();
  return useQuery({
    queryKey: [...KEY, 'spaces'],
    queryFn: getCommunitySpaces,
    enabled: on && enabled,
    staleTime: 20_000,
  });
}

/** The tab badge: unread published posts across every space. Polls only while its screen is in front. */
export function useCommunityUnread(enabled = true, onScreen = false) {
  const on = useCommunityEnabled();
  return useQuery({
    queryKey: [...KEY, 'unread'],
    queryFn: getCommunityUnread,
    enabled: on && enabled,
    staleTime: 30_000,
    refetchInterval: onScreen ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
}

/** One space's feed, newest first, a page at a time. */
export function useCommunityFeed(teacherId: number | null, audience: CommunityAudience, filter: CommunityFilter = 'all', enabled = true) {
  const on = useCommunityEnabled();
  return useInfiniteQuery({
    queryKey: [...KEY, 'feed', teacherId, audience, filter],
    queryFn: ({ pageParam }) => getCommunityFeed(teacherId as number, audience, pageParam ?? null, filter),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.next_before,
    enabled: on && enabled && !!teacherId,
    staleTime: 15_000,
  });
}

export function useCommunityPost(postId: number, enabled = true) {
  const on = useCommunityEnabled();
  return useQuery({
    queryKey: [...KEY, 'post', postId],
    queryFn: () => getCommunityPost(postId),
    enabled: on && enabled && postId > 0,
    staleTime: 10_000,
  });
}

export function useCommunityQueue(teacherId: number | null, enabled = true) {
  const on = useCommunityEnabled();
  return useQuery({
    queryKey: [...KEY, 'queue', teacherId],
    queryFn: () => getCommunityQueue(teacherId as number),
    enabled: on && enabled && !!teacherId,
    staleTime: 15_000,
  });
}

export function useCommunitySettings(teacherId: number | null, enabled = true) {
  const on = useCommunityEnabled();
  return useQuery({
    queryKey: [...KEY, 'settings', teacherId],
    queryFn: () => getCommunitySettings(teacherId as number),
    enabled: on && enabled && !!teacherId,
    staleTime: 60_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useCreateCommunityPost(teacherId: number, audience: CommunityAudience) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: CreatePostInput) => createCommunityPost(teacherId, audience, input), onSuccess: invalidate });
}

export function useEditCommunityPost() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ postId, body }: { postId: number; body: string }) => editCommunityPost(postId, body), onSuccess: invalidate });
}

export function useDeleteCommunityPost() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ postId, note }: { postId: number; note?: string }) => deleteCommunityPost(postId, note), onSuccess: invalidate });
}

export function useModerateCommunityPost() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ postId, action, note }: { postId: number; action: PostModeration; note?: string }) => moderateCommunityPost(postId, action, note), onSuccess: invalidate });
}

export function useCommentOnCommunityPost(postId: number) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: string) => commentOnCommunityPost(postId, body), onSuccess: invalidate });
}

export function useDeleteCommunityComment() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ commentId, note }: { commentId: number; note?: string }) => deleteCommunityComment(commentId, note), onSuccess: invalidate });
}

export function useModerateCommunityComment() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ commentId, action, note }: { commentId: number; action: CommentModeration; note?: string }) => moderateCommunityComment(commentId, action, note), onSuccess: invalidate });
}

/**
 * React: the feed's copy of the post is patched in place (counts and my_reaction) so the
 * tap answers at once; the next refetch confirms it.
 */
export function useReactToCommunityPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, kind }: { postId: number; kind: CommunityReaction }) => reactToCommunityPost(postId, kind),
    onSuccess: (res, { postId }) => {
      const patch = (p: CommunityPost) => (p.id === postId ? { ...p, reaction_counts: res.reaction_counts, reactions_count: res.reactions_count, my_reaction: res.my_reaction } : p);
      qc.setQueriesData({ queryKey: [...KEY, 'feed'] }, (old: unknown) => {
        const data = old as { pages?: { posts: CommunityPost[] }[] } | undefined;
        return data?.pages ? { ...data, pages: data.pages.map((pg) => ({ ...pg, posts: pg.posts.map(patch) })) } : old;
      });
      qc.setQueriesData({ queryKey: [...KEY, 'post', postId] }, (old: unknown) => {
        const data = old as { post: CommunityPost } | undefined;
        return data?.post ? { ...data, post: patch(data.post) } : old;
      });
    },
  });
}

export function useReportCommunityPost() {
  return useMutation({ mutationFn: ({ postId, reason, note }: { postId: number; reason: string; note?: string }) => reportCommunityPost(postId, reason, note) });
}

export function useReportCommunityComment() {
  return useMutation({ mutationFn: ({ commentId, reason, note }: { commentId: number; reason: string; note?: string }) => reportCommunityComment(commentId, reason, note) });
}

export function useResolveCommunityReport() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ reportId, action, note }: { reportId: number; action: ReportResolution; note?: string }) => resolveCommunityReport(reportId, action, note), onSuccess: invalidate });
}

export function useUpdateCommunitySettings(teacherId: number) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (patch: Partial<CommunitySettings>) => updateCommunitySettings(teacherId, patch), onSuccess: invalidate });
}

export function useUploadCommunityMedia(teacherId: number, audience: CommunityAudience) {
  return useMutation({ mutationFn: (input: UploadMediaInput) => uploadCommunityMedia(teacherId, audience, input) });
}
