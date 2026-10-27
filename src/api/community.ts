import client from './client';

/**
 * «مجتمعنا» — the teacher's community (docs/COMMUNITY.md on the backend). One space per
 * (teacher, audience): a students' space and a parents' space. Every endpoint is absent (404)
 * while the `community` flag is off; callers gate on the flag first. Who may post, comment,
 * moderate is decided server-side: the client shows what it is told and repeats the
 * server's sentence when something is refused.
 */

export type CommunityAudience = 'students' | 'parents';
export type CommunityRole = 'teacher' | 'assistant' | 'student' | 'parent';
export type CommunityStatus = 'published' | 'held' | 'rejected' | 'hidden';
export type CommunityReaction = 'like' | 'love' | 'clap' | 'idea';
export type CommunityKind = 'post' | 'announcement';

export interface CommunitySpace {
  teacher_id: number;
  teacher_name: string;
  teacher_logo_url: string | null;
  /** Students in the students' space, linked parents in the parents'. */
  members: number;
  audience: CommunityAudience;
  role: CommunityRole;
  can_post: boolean;
  comments_on: boolean;
  welcome: string | null;
  posts: number;
  unread: number;
  /** Moderators: posts waiting for a look. */
  held: number;
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
  /** The same generated face as everywhere in the app (`GeneratedAvatar`). */
  avatar_seed: string;
  /** The teacher's logo, when they uploaded one. */
  avatar_url: string | null;
}

export interface CommunityPost {
  id: number;
  teacher_id: number;
  audience: CommunityAudience;
  kind: CommunityKind;
  body: string;
  author: CommunityAuthor;
  mine: boolean;
  status: CommunityStatus;
  /** The author's and the moderators' business only: null for everyone else. */
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
export type CommunityFilter = 'all' | 'mine' | 'held' | 'flagged';

export interface CommunitySettings {
  students_can_post: boolean;
  parents_can_post: boolean;
  comments_on: boolean;
  review_students: 'screen' | 'approve';
  review_parents: 'screen' | 'approve';
  flag_words: string[];
  welcome: string | null;
}

export interface CommunityReport {
  id: number;
  post_id: number | null;
  comment_id: number | null;
  audience: CommunityAudience;
  reason: string;
  reason_label: string;
  note: string | null;
  captured_body: string | null;
  reported_user: { id: number; name: string } | null;
  created_at: string;
}

export interface CommunityQueue {
  held_posts: CommunityPost[];
  held_comments: CommunityComment[];
  flagged_posts: CommunityPost[];
  reports: CommunityReport[];
  actions: string[];
}

export type PostModeration = 'approve' | 'reject' | 'hide' | 'restore' | 'pin' | 'unpin';
export type CommentModeration = 'approve' | 'reject' | 'hide';
export type ReportResolution = 'dismiss' | 'warn' | 'remove' | 'escalate';

export async function getCommunitySpaces(): Promise<{ spaces: CommunitySpace[]; limits: CommunityLimits }> {
  const { data } = await client.get('/community');
  return { spaces: (data?.spaces ?? []) as CommunitySpace[], limits: data?.limits as CommunityLimits };
}

export async function getCommunityUnread(): Promise<number> {
  const { data } = await client.get('/community/unread');
  return Number(data?.unread ?? 0);
}

export async function getCommunityFeed(teacherId: number, audience: CommunityAudience, before?: number | null, filter: CommunityFilter = 'all'): Promise<CommunityFeedPage> {
  const { data } = await client.get(`/community/${teacherId}/${audience}/posts`, { params: { ...(before ? { before } : {}), ...(filter !== 'all' ? { filter } : {}) } });
  return { role: data.role, posts: (data?.posts ?? []) as CommunityPost[], next_before: data?.next_before ?? null };
}

export async function markCommunitySeen(teacherId: number, audience: CommunityAudience, postId?: number): Promise<void> {
  await client.post(`/community/${teacherId}/${audience}/seen`, postId ? { post_id: postId } : {});
}

export interface CreatePostInput { body: string; kind?: CommunityKind; media?: number[] }

export async function createCommunityPost(teacherId: number, audience: CommunityAudience, input: CreatePostInput): Promise<CommunityPost> {
  const { data } = await client.post(`/community/${teacherId}/${audience}/posts`, input);
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

/** The author withdraws; a moderator hides (with a note the author reads). */
export async function deleteCommunityPost(postId: number, note?: string): Promise<void> {
  await client.delete(`/community/posts/${postId}`, { data: note ? { note } : {} });
}

export async function moderateCommunityPost(postId: number, action: PostModeration, note?: string): Promise<CommunityPost> {
  const { data } = await client.post(`/community/posts/${postId}/moderate`, { action, ...(note ? { note } : {}) });
  return data.post as CommunityPost;
}

export async function commentOnCommunityPost(postId: number, body: string): Promise<{ comment: CommunityComment; comments_count: number }> {
  const { data } = await client.post(`/community/posts/${postId}/comments`, { body });
  return { comment: data.comment as CommunityComment, comments_count: Number(data?.comments_count ?? 0) };
}

export async function deleteCommunityComment(commentId: number, note?: string): Promise<void> {
  await client.delete(`/community/comments/${commentId}`, { data: note ? { note } : {} });
}

export async function moderateCommunityComment(commentId: number, action: CommentModeration, note?: string): Promise<CommunityComment> {
  const { data } = await client.post(`/community/comments/${commentId}/moderate`, { action, ...(note ? { note } : {}) });
  return data.comment as CommunityComment;
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

export async function getCommunityQueue(teacherId: number): Promise<CommunityQueue> {
  const { data } = await client.get(`/community/${teacherId}/queue`);
  return data as CommunityQueue;
}

export async function resolveCommunityReport(reportId: number, action: ReportResolution, note?: string): Promise<void> {
  await client.post(`/community/reports/${reportId}/resolve`, { action, ...(note ? { note } : {}) });
}

export async function getCommunitySettings(teacherId: number): Promise<CommunitySettings> {
  const { data } = await client.get(`/community/${teacherId}/settings`);
  return data.settings as CommunitySettings;
}

export async function updateCommunitySettings(teacherId: number, patch: Partial<CommunitySettings>): Promise<CommunitySettings> {
  const { data } = await client.post(`/community/${teacherId}/settings`, patch);
  return data.settings as CommunitySettings;
}

export interface UploadMediaInput { uri: string; name: string; mime: string }

export async function uploadCommunityMedia(teacherId: number, audience: CommunityAudience, input: UploadMediaInput): Promise<CommunityMedia> {
  const form = new FormData();
  form.append('teacher_id', String(teacherId));
  form.append('audience', audience);
  form.append('file', { uri: input.uri, name: input.name, type: input.mime } as unknown as Blob);
  const { data } = await client.post('/community/media', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 3 * 60 * 1000 });
  return data.media as CommunityMedia;
}
