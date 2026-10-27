import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import {
  commentOnCommunityPost, createCommunityPost, deleteCommunityComment, deleteCommunityPost, editCommunityPost, getCommunityFeed,
  getCommunityPost, getCommunitySpaces, getCommunityUnread, reactToCommunityPost, reportCommunityComment, reportCommunityPost,
  uploadCommunityMedia,
  type CommunityAudience, type CommunityFilter, type CommunityPost, type CommunityReaction, type CreatePostInput, type UploadMediaInput,
} from '@/api/community';

export const COMMUNITY_FLAG = 'community';

/** True only when the server switched the community on for this person. Everything hangs off this. */
export function useCommunityEnabled(): boolean {
  const { data: flags } = useFeatureFlags();
  return !!flags?.[COMMUNITY_FLAG];
}

const KEY = ['community'] as const;

/** A refused call (404 off, 403 not mine, 423 agreement due) is an answer, not a hiccup: no retry. */
const retry = (count: number, err: unknown) => {
  const status = (err as { response?: { status?: number } } | null)?.response?.status;
  return !(status && status >= 400 && status < 500) && count < 2;
};

/** The communities this person reads (one, or both for a teacher) with unread counts. */
export function useCommunitySpaces(enabled = true) {
  const on = useCommunityEnabled();
  return useQuery({
    queryKey: [...KEY, 'spaces'],
    queryFn: getCommunitySpaces,
    retry,
    enabled: on && enabled,
    staleTime: 20_000,
  });
}

/** The tab badge: unread published posts across what this person reads. Polls only while its screen is in front. */
export function useCommunityUnread(enabled = true, onScreen = false) {
  const on = useCommunityEnabled();
  return useQuery({
    queryKey: [...KEY, 'unread'],
    queryFn: getCommunityUnread,
    retry,
    enabled: on && enabled,
    staleTime: 30_000,
    refetchInterval: onScreen ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
}

/** One community's feed, newest first, a page at a time. */
export function useCommunityFeed(audience: CommunityAudience, filter: CommunityFilter = 'all', enabled = true) {
  const on = useCommunityEnabled();
  return useInfiniteQuery({
    queryKey: [...KEY, 'feed', audience, filter],
    queryFn: ({ pageParam }) => getCommunityFeed(audience, pageParam ?? null, filter),
    initialPageParam: null as number | null,
    retry,
    getNextPageParam: (last) => last.next_before,
    enabled: on && enabled,
    staleTime: 15_000,
  });
}

export function useCommunityPost(postId: number, enabled = true) {
  const on = useCommunityEnabled();
  return useQuery({
    queryKey: [...KEY, 'post', postId],
    queryFn: () => getCommunityPost(postId),
    retry,
    enabled: on && enabled && postId > 0,
    staleTime: 10_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useCreateCommunityPost(audience: CommunityAudience) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: CreatePostInput) => createCommunityPost(audience, input), onSuccess: invalidate });
}

export function useEditCommunityPost() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ postId, body }: { postId: number; body: string }) => editCommunityPost(postId, body), onSuccess: invalidate });
}

export function useDeleteCommunityPost() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ postId }: { postId: number }) => deleteCommunityPost(postId), onSuccess: invalidate });
}

export function useCommentOnCommunityPost(postId: number) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: string) => commentOnCommunityPost(postId, body), onSuccess: invalidate });
}

export function useDeleteCommunityComment() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ commentId }: { commentId: number }) => deleteCommunityComment(commentId), onSuccess: invalidate });
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

export function useUploadCommunityMedia(audience: CommunityAudience) {
  return useMutation({ mutationFn: (input: UploadMediaInput) => uploadCommunityMedia(audience, input) });
}
