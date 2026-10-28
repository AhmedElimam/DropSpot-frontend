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
  /** The colours the server offers short posts (absent from an older server: all of the app's). */
  backgrounds?: CommunityBackground[];
  /**
   * May members add pictures at all? Off until every picture is screened before anyone sees it
   * (the guard-rails spec §6); absent from an older server = on. Existing pictures still show.
   */
  media?: boolean;
}

/**
 * Where the viewer stands in the community (the guard-rails spec, Part C). Private: it is only
 * ever about the viewer, never shown to anyone else. A suspension stops writing, never reading.
 */
export interface CommunityStanding {
  can_participate: boolean;
  suspended_until: string | null;
  removed: boolean;
  /** The server's own sentence for why writing is stopped. */
  message: string | null;
  open_strikes: number;
}

export type StrikeLevel = 'warning_1' | 'warning_2' | 'suspension_short' | 'suspension_long' | 'severe' | 'removal';

export interface CommunityStrike {
  id: number;
  level: StrikeLevel;
  reason_label: string;
  created_at: string;
  ends_at: string | null;
  /** Still moves the ladder (not faded, not reversed on appeal). */
  counting: boolean;
  appeal: { status: 'pending' | 'accepted' | 'rejected'; at: string; note: string | null } | null;
  can_appeal: boolean;
}

export interface CommunityStandingDetail {
  me: { strikes: CommunityStrike[] };
  /** A parent: each child's own record. */
  children: { student_id: number; name: string; strikes: CommunityStrike[] }[];
}

export interface CommunityBlock { user_id: number; name: string; avatar_seed: string; blocked_at: string }

/**
 * Why a write was refused, from the server's `code` (the guard-rails spec §4, §10):
 * `nudge` = rewrite it (a number, a link, a word, Franco or English — nothing is recorded),
 * `suspended` = writing is stopped for now, `rate_limited` = slow down. null = an ordinary error.
 */
export type WriteRefusal = { code: 'nudge'; kind: string | null; message: string } | { code: 'suspended' | 'rate_limited'; message: string };

export interface CommunityMedia {
  id: number; url: string; width: number | null; height: number | null;
  /** A post's picture has its own reactions and comment thread (absent on a comment's picture). */
  reactions_count?: number;
  reaction_counts?: Partial<Record<CommunityReaction, number>>;
  my_reaction?: CommunityReaction | null;
  comments_count?: number;
}

/** The coloured backgrounds a short text-only post may sit on (drawn by the app; see backgrounds.ts). */
export type CommunityBackground = 'indigo' | 'sunset' | 'mint' | 'rose' | 'night' | 'sky';

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
  /** A short text-only post drawn on a colour; null = plain. */
  background: CommunityBackground | null;
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
  /** The picture whose thread this is; null = the post's own. */
  media_id: number | null;
  body: string;
  /** A picture carried by the comment. */
  attachment: CommunityMedia | null;
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

export async function getCommunitySpaces(): Promise<{ spaces: CommunitySpace[]; limits: CommunityLimits; standing: CommunityStanding | null }> {
  const { data } = await client.get('/community');
  return { spaces: (data?.spaces ?? []) as CommunitySpace[], limits: data?.limits as CommunityLimits, standing: (data?.standing ?? null) as CommunityStanding | null };
}

/** The server's refusal code on a failed write, or null when it is an ordinary error. */
export function writeRefusal(err: unknown): WriteRefusal | null {
  const res = (err as { response?: { status?: number; data?: { code?: string; kind?: string; message?: string } } } | null)?.response;
  const code = res?.data?.code;
  const message = typeof res?.data?.message === 'string' ? res.data.message : '';
  if (!message) return null;
  if (code === 'nudge') return { code, kind: res?.data?.kind ?? null, message };
  if (code === 'suspended' || code === 'rate_limited') return { code, message };
  return null;
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

export interface CreatePostInput { body: string; media?: number[]; background?: CommunityBackground | null }

/**
 * `support` is set when the words read as someone hurting (the spec §5.1): the post is held
 * from the community and the author is answered gently with this text, never as a violation.
 */
export type CreatedPost = CommunityPost & { support?: string | null };

export async function createCommunityPost(audience: CommunityAudience, input: CreatePostInput): Promise<CreatedPost> {
  const { data } = await client.post(`/community/${audience}/posts`, input);
  return { ...(data.post as CommunityPost), support: data?.support ?? null };
}

export async function getCommunityPost(postId: number): Promise<{ role: CommunityRole; post: CommunityPost; comments: CommunityComment[]; next_after: number | null }> {
  const { data } = await client.get(`/community/posts/${postId}`);
  return { role: data.role, post: data.post as CommunityPost, comments: (data?.comments ?? []) as CommunityComment[], next_after: data?.next_after ?? null };
}

export interface CommentsPage { comments: CommunityComment[]; next_after: number | null }

/** A page of a thread: the post's own comments, or one picture's (`mediaId`), oldest first. */
export async function getCommunityComments(postId: number, mediaId: number | null, after?: number | null): Promise<CommentsPage> {
  const { data } = await client.get(`/community/posts/${postId}/comments`, { params: { ...(mediaId ? { media: mediaId } : {}), ...(after ? { after } : {}) } });
  return { comments: (data?.comments ?? []) as CommunityComment[], next_after: data?.next_after ?? null };
}

export async function editCommunityPost(postId: number, body: string, background?: CommunityBackground | null): Promise<CommunityPost> {
  const { data } = await client.patch(`/community/posts/${postId}`, { body, ...(background !== undefined ? { background } : {}) });
  return data.post as CommunityPost;
}

/** The author withdraws their own post. */
export async function deleteCommunityPost(postId: number): Promise<void> {
  await client.delete(`/community/posts/${postId}`);
}

export interface CommentInput { body: string; media_id?: number | null; attachment_id?: number | null }

export async function commentOnCommunityPost(postId: number, input: CommentInput): Promise<{ comment: CommunityComment; comments_count: number; support: string | null }> {
  const { data } = await client.post(`/community/posts/${postId}/comments`, input);
  return { comment: data.comment as CommunityComment, comments_count: Number(data?.comments_count ?? 0), support: data?.support ?? null };
}

export async function deleteCommunityComment(commentId: number): Promise<void> {
  await client.delete(`/community/comments/${commentId}`);
}

export interface ReactResult { reaction_counts: Partial<Record<CommunityReaction, number>>; reactions_count: number; my_reaction: CommunityReaction | null }

export async function reactToCommunityPost(postId: number, kind: CommunityReaction): Promise<ReactResult> {
  const { data } = await client.post(`/community/posts/${postId}/react`, { kind });
  return data as ReactResult;
}

/** A reaction on one picture of a post (toggle). */
export async function reactToCommunityMedia(mediaId: number, kind: CommunityReaction): Promise<ReactResult> {
  const { data } = await client.post(`/community/media/${mediaId}/react`, { kind });
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

// ── Blocking (personal, private: the blocked member is never told) ──────────

export async function getCommunityBlocks(): Promise<CommunityBlock[]> {
  const { data } = await client.get('/community/blocks');
  return (data?.blocks ?? []) as CommunityBlock[];
}

export async function blockCommunityMember(userId: number): Promise<void> {
  await client.post(`/community/blocks/${userId}`);
}

export async function unblockCommunityMember(userId: number): Promise<void> {
  await client.delete(`/community/blocks/${userId}`);
}

// ── Standing: warnings, suspensions, appeals (private to the member and their parent) ──

export async function getCommunityStanding(): Promise<CommunityStandingDetail> {
  const { data } = await client.get('/community/standing');
  return { me: { strikes: (data?.me?.strikes ?? []) as CommunityStrike[] }, children: (data?.children ?? []) as CommunityStandingDetail['children'] };
}

export async function appealCommunityStrike(strikeId: number, body: string): Promise<CommunityStrike> {
  const { data } = await client.post(`/community/strikes/${strikeId}/appeal`, { body });
  return data.strike as CommunityStrike;
}
