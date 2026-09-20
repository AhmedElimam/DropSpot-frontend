import client from './client';

/**
 * Grade-wide question threads («النقاشات») — docs/THREADS.md on the backend.
 *
 * Every endpoint is absent (404) while the `threads` feature flag is off; callers gate on the
 * flag first. Who may comment, vote, answer or moderate is decided server-side and arrives in
 * `permissions` — the client shows what it is told and repeats the server's sentence when
 * something is refused.
 */

export type ThreadKind = 'question' | 'answer' | 'note';
export type ThreadRole = 'teacher' | 'assistant' | 'student' | null;
export type ClosedReason = 'answered' | 'locked' | 'timer' | null;

export interface ThreadVideo {
  id: number;
  duration: number;
  width: number | null;
  height: number | null;
  expired: boolean;
  poster_url: string | null;
}

export interface ThreadAnswer {
  id: number;
  body: string | null;
  video: ThreadVideo | null;
  created_at: string;
}

export interface ThreadPermissions {
  role: ThreadRole;
  can_comment: boolean;
  can_vote: boolean;
  can_moderate: boolean;
  can_answer: boolean;
  can_extend: boolean;
  can_lock: boolean;
}

export interface Thread {
  id: number;
  kind: ThreadKind;
  title: string | null;
  body: string | null;
  grade: { id: number; name: string | null };
  teacher: { id: number; name: string };
  video: ThreadVideo | null;
  comments_close_at: string | null;
  seconds_left: number | null;
  open: boolean;
  closed_reason: ClosedReason;
  reveal_at_close: boolean;
  /** Quiz mode, clock running, reader is a student: others' answers are withheld. */
  answers_hidden: boolean;
  answered_at: string | null;
  answer: ThreadAnswer | null;
  comments_count: number;
  /** Moderators only. */
  audience_count: number | null;
  my_comment_id: number | null;
  downvotes_enabled: boolean;
  unread: boolean;
  permissions: ThreadPermissions;
  created_at: string;
}

export interface ThreadComment {
  id: number;
  body: string | null;
  author: { id: number; name: string; is_me: boolean };
  up: number;
  down: number;
  score: number;
  my_vote: -1 | 0 | 1;
  picked: boolean;
  hidden: boolean;
  hidden_reason: string | null;
  created_at: string;
  edited: boolean;
}

export interface ThreadLimits {
  title_max_chars: number;
  body_max_chars: number;
  comment_max_chars: number;
  close_min_minutes: number;
  close_max_minutes: number;
  video_max_seconds: number;
  video_max_kb: number;
  poll_ms: number;
}

export interface ThreadSettings {
  enabled: boolean;
  default_close_hours: number;
  downvotes_enabled: boolean;
}

export interface ThreadGrade {
  id: number;
  name: string;
  students: number;
  courses: number;
}

export interface ThreadsFeed {
  threads: Thread[];
  page_size: number;
  unread: number;
  limits: ThreadLimits;
  /** Teacher only. */
  settings?: ThreadSettings;
  grades?: ThreadGrade[];
  open_reports?: number;
}

export interface ThreadDetail {
  thread: Thread;
  comments: ThreadComment[];
  report_reasons: Record<string, string>;
  limits: ThreadLimits;
}

export interface ThreadPlay {
  play_id: number;
  code: string;
  url: string;
  expires_at: string;
  watermark: { name: string; student_code: string | null; phone_tail: string | null; code: string };
}

export interface ThreadReport {
  id: number;
  thread_id: number;
  comment_id: number | null;
  reason: string;
  reason_label: string;
  note: string | null;
  captured_body: string | null;
  reported_user: { id: number; name: string };
  reporter: { id: number; name: string };
  already_hidden: boolean;
  created_at: string;
}

export interface ThreadViewer {
  user_id: number;
  name: string;
  student_code: string | null;
  codes: string[];
  plays: number;
  streams: number;
  first_at: string | null;
  last_at: string | null;
  capture_attempts: number;
  capture_kinds: string[];
  last_capture_at: string | null;
}

export interface ThreadAudience {
  video_id: number;
  plays_count: number;
  viewers: ThreadViewer[];
  capture_attempts: number;
}

export async function getThreadsFeed(beforeId?: number): Promise<ThreadsFeed> {
  const { data } = await client.get('/threads', { params: beforeId ? { before_id: beforeId } : undefined });
  return data as ThreadsFeed;
}

export async function getThreadsUnread(): Promise<number> {
  const { data } = await client.get('/threads/unread');
  return Number(data?.unread ?? 0);
}

export async function getThread(id: number): Promise<ThreadDetail> {
  const { data } = await client.get(`/threads/${id}`);
  return data as ThreadDetail;
}

export interface ComposeThreadInput {
  kind: 'question' | 'note';
  grade_id: number;
  title?: string;
  body?: string;
  video_id?: number | null;
  /** null = no timer. */
  close_minutes?: number | null;
  reveal_at_close?: boolean;
}

export async function createThread(input: ComposeThreadInput): Promise<Thread> {
  const { data } = await client.post('/threads', input);
  return data.thread as Thread;
}

export async function answerThread(id: number, input: { body?: string; video_id?: number | null }): Promise<Thread> {
  const { data } = await client.post(`/threads/${id}/answer`, input);
  return data.thread as Thread;
}

export async function lockThread(id: number): Promise<Thread> {
  const { data } = await client.post(`/threads/${id}/lock`);
  return data.thread as Thread;
}

export async function extendThread(id: number, closeMinutes: number | null): Promise<Thread> {
  const { data } = await client.post(`/threads/${id}/extend`, { close_minutes: closeMinutes });
  return data.thread as Thread;
}

export async function withdrawThread(id: number): Promise<void> {
  await client.delete(`/threads/${id}`);
}

export async function commentOnThread(id: number, body: string): Promise<ThreadComment> {
  const { data } = await client.post(`/threads/${id}/comments`, { body });
  return data.comment as ThreadComment;
}

export async function hideThreadComment(commentId: number, reason?: string): Promise<void> {
  await client.delete(`/threads/comments/${commentId}`, { data: reason ? { reason } : undefined });
}

export async function voteThreadComment(commentId: number, value: -1 | 0 | 1): Promise<ThreadComment> {
  const { data } = await client.post(`/threads/comments/${commentId}/vote`, { value });
  return data.comment as ThreadComment;
}

export async function pickThreadComment(commentId: number, picked: boolean): Promise<ThreadComment> {
  const { data } = await client.post(`/threads/comments/${commentId}/pick`, { picked });
  return data.comment as ThreadComment;
}

export async function reportThreadComment(commentId: number, reason: string, note?: string): Promise<string> {
  const { data } = await client.post(`/threads/comments/${commentId}/report`, { reason, note: note || undefined });
  return String(data?.message ?? '');
}

export async function updateThreadSettings(input: Partial<ThreadSettings>): Promise<ThreadSettings> {
  const { data } = await client.post('/threads/settings', input);
  return data.settings as ThreadSettings;
}

export async function getThreadReports(): Promise<ThreadReport[]> {
  const { data } = await client.get('/threads/reports');
  return (data?.reports ?? []) as ThreadReport[];
}

export async function resolveThreadReport(reportId: number, action: 'dismiss' | 'remove'): Promise<void> {
  await client.post(`/threads/reports/${reportId}/resolve`, { action });
}

/**
 * Upload a recording. Multipart; the server checks the bytes' type and the duration cap.
 * The result is claimed by the next create/answer call through `video_id`.
 */
export async function uploadThreadVideo(input: { uri: string; name: string; mime: string; duration: number; width?: number; height?: number }): Promise<ThreadVideo> {
  const form = new FormData();
  form.append('duration', String(Math.max(1, Math.round(input.duration))));
  if (input.width) form.append('width', String(input.width));
  if (input.height) form.append('height', String(input.height));
  form.append('file', { uri: input.uri, name: input.name, type: input.mime } as unknown as Blob);
  const { data } = await client.post('/threads/videos', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  });
  return data.video as ThreadVideo;
}

/** Open one viewing: the row the watermark points back to, and the stream URL. */
export async function openThreadVideoPlay(videoId: number): Promise<ThreadPlay> {
  const { data } = await client.post(`/threads/videos/${videoId}/plays`);
  return data as ThreadPlay;
}

/** The OS reported a screenshot / recording over a thread video. Fire and forget. */
export async function reportThreadCapture(videoId: number, playId: number | null, kind: 'screenshot' | 'recording', platform: string): Promise<void> {
  try {
    await client.post(`/threads/videos/${videoId}/captures`, { kind, play_id: playId ?? undefined, platform });
  } catch {
    // Never let telemetry break playback.
  }
}

export async function getThreadVideoAudience(videoId: number): Promise<ThreadAudience> {
  const { data } = await client.get(`/threads/videos/${videoId}/audience`);
  return data as ThreadAudience;
}
