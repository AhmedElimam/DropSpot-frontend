import client from './client';

/**
 * «مجتمعنا» — the platform's two open communities (docs/COMMUNITY.md on the backend): every
 * student in one, every parent in the other, no teacher owns one (founder 2026-10-28). Every
 * endpoint is absent (404) while the `community` flag is off; callers gate on the flag first.
 * Who may post or comment is decided server-side: the client shows what it is told and repeats
 * the server's sentence when something is refused. Moderation never happens in the app (ops
 * moderate from the ops room), so there is no moderation call here.
 */

export type CommunityAudience = 'students' | 'parents';
/** `teacher` reads both communities and writes in neither; `staff` is the platform's own team. */
export type CommunityRole = 'student' | 'parent' | 'teacher' | 'staff';
export type CommunityStatus = 'published' | 'held' | 'rejected' | 'hidden';
export type CommunityReaction = 'like' | 'love' | 'clap' | 'idea';
export type CommunityKind = 'post' | 'announcement';

export interface CommunitySpace {
  audience: CommunityAudience;
  role: CommunityRole;
  /** Students on the platform, or linked parents. */
  members: number;
  can_post: boolean;
  comments_on: boolean;
  welcome: string | null;
  posts: number;
  unread: number;
}

export interface CommunityLimits {
  body_max_chars: number;
  comment_max_chars: number;
  images_per_post: number;
  image_max_kb: number;
  poll_ms: number;
  reactions: CommunityReaction[];
  report_reasons: Record<string, string>;
}

export interface CommunityMedia { id: number; url: string; width: number | null; height: number | null }

export interface CommunityAuthor {
  id: number;
  name: string;
  role: CommunityRole;
  /** The same generated face as everywhere in the app (`GeneratedAvatar`); `staff` draws the brand mark. */
  avatar_seed: string;
  avatar_url: string | null;
}

export interface CommunityPost {
  id: number;
  audience: CommunityAudience;
  kind: CommunityKind;
  body: string;
  author: CommunityAuthor;
  mine: boolean;
  status: CommunityStatus;
  /** The author's business only: null for everyone else. */
  status_reason: string | null;
  status_note: string | null;
  flagged: boolean;
  pinned: boolean;
  media: CommunityMedia[];
  comments_count: number;
  reactions_count: number;
  reaction_counts: Partial<Record<CommunityReaction, number>>;
  my_reaction: CommunityReaction | null;
  /** The newest published comment — the feed's one-line preview. */
  last_comment: CommunityComment | null;
  edited_at: string | null;
  created_at: string;
}

export interface CommunityComment {
  id: number;
  post_id: number;
  body: string;
  author: CommunityAuthor;
  mine: boolean;
  status: CommunityStatus;
  status_reason: string | null;
  status_note: string | null;
  flagged: boolean;
  created_at: string;
}

export interface CommunityFeedPage { role: CommunityRole; posts: CommunityPost[]; next_before: number | null }
export type CommunityFilter = 'all' | 'mine';

/** A member writes; a teacher reads. */
export function canWrite(role: CommunityRole | null | undefined): boolean {
  return role === 'student' || role === 'parent' || role === 'staff';
}

export async function getCommunitySpaces(): Promise<{ spaces: CommunitySpace[]; limits: CommunityLimits }> {
  const { data } = await client.get('/community');
  return { spaces: (data?.spaces ?? []) as CommunitySpace[], limits: data?.limits as CommunityLimits };
}

export async function getCommunityUnread(): Promise<number> {
  const { data } = await client.get('/community/unread');
  return Number(data?.unread ?? 0);
}

export async function getCommunityFeed(audience: CommunityAudience, before?: number | null, filter: CommunityFilter = 'all'): Promise<CommunityFeedPage> {
  const { data } = await client.get(`/community/${audience}/posts`, { params: { ...(before ? { before } : {}), ...(filter !== 'all' ? { filter } : {}) } });
  return { role: data.role, posts: (data?.posts ?? []) as CommunityPost[], next_before: data?.next_before ?? null };
}

export async function markCommunitySeen(audience: CommunityAudience, postId?: number): Promise<void> {
  await client.post(`/community/${audience}/seen`, postId ? { post_id: postId } : {});
}

export interface CreatePostInput { body: string; media?: number[] }

export async function createCommunityPost(audience: CommunityAudience, input: CreatePostInput): Promise<CommunityPost> {
  const { data } = await client.post(`/community/${audience}/posts`, input);
  return data.post as CommunityPost;
}

export async function getCommunityPost(postId: number): Promise<{ role: CommunityRole; post: CommunityPost; comments: CommunityComment[] }> {
  const { data } = await client.get(`/community/posts/${postId}`);
  return { role: data.role, post: data.post as CommunityPost, comments: (data?.comments ?? []) as CommunityComment[] };
}

export async function editCommunityPost(postId: number, body: string): Promise<CommunityPost> {
  const { data } = await client.patch(`/community/posts/${postId}`, { body });
  return data.post as CommunityPost;
}

/** The author withdraws their own post. */
export async function deleteCommunityPost(postId: number): Promise<void> {
  await client.delete(`/community/posts/${postId}`);
}

export async function commentOnCommunityPost(postId: number, body: string): Promise<{ comment: CommunityComment; comments_count: number }> {
  const { data } = await client.post(`/community/posts/${postId}/comments`, { body });
  return { comment: data.comment as CommunityComment, comments_count: Number(data?.comments_count ?? 0) };
}

export async function deleteCommunityComment(commentId: number): Promise<void> {
  await client.delete(`/community/comments/${commentId}`);
}

export interface ReactResult { reaction_counts: Partial<Record<CommunityReaction, number>>; reactions_count: number; my_reaction: CommunityReaction | null }

export async function reactToCommunityPost(postId: number, kind: CommunityReaction): Promise<ReactResult> {
  const { data } = await client.post(`/community/posts/${postId}/react`, { kind });
  return data as ReactResult;
}

export async function reportCommunityPost(postId: number, reason: string, note?: string): Promise<number> {
  const { data } = await client.post(`/community/posts/${postId}/report`, { reason, ...(note ? { note } : {}) });
  return Number(data?.report_id ?? 0);
}

export async function reportCommunityComment(commentId: number, reason: string, note?: string): Promise<number> {
  const { data } = await client.post(`/community/comments/${commentId}/report`, { reason, ...(note ? { note } : {}) });
  return Number(data?.report_id ?? 0);
}

export interface UploadMediaInput { uri: string; name: string; mime: string }

export async function uploadCommunityMedia(audience: CommunityAudience, input: UploadMediaInput): Promise<CommunityMedia> {
  const form = new FormData();
  form.append('audience', audience);
  form.append('file', { uri: input.uri, name: input.name, type: input.mime } as unknown as Blob);
  const { data } = await client.post('/community/media', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 3 * 60 * 1000 });
  return data.media as CommunityMedia;
}
