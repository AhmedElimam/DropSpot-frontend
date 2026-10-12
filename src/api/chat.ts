import client from './client';
import { STAGING_HEADER, STAGING_KEY } from '@/config/env';

/**
 * Course group chat — the STUDENT side of the room (Course Group Chat spec).
 *
 * Every endpoint is absent (404) while the `course_chat` feature flag is off; callers gate
 * on the flag before calling, and treat a 404 as "not available" rather than an error.
 * Membership, muting and blocking are decided server-side — the client only shows what it
 * is told and repeats the sentence the server gives when something is refused.
 */

export interface ChatChannelSummary {
  course_id: number;
  course_name: string | null;
  unread: number;
  notify: boolean;
  locked: boolean;
  announcements_only: boolean;
  last_message_at: string | null;
  /** One line for the list row — text, or «صورة» / «رسالة صوتية» / a file name. */
  last_preview: string | null;
  last_sender: string | null;
  last_mine: boolean;
}

export interface ChatSender {
  id: number;
  name: string;
  /** The course teacher or an assistant — the client shows a badge so a child always knows an adult is speaking. */
  is_staff: boolean;
  is_teacher: boolean;
}

export type ChatAttachmentKind = 'image' | 'file' | 'voice';

export interface ChatAttachment {
  kind: ChatAttachmentKind;
  name: string | null;
  mime: string | null;
  size: number | null;
  /** Voice notes: seconds. */
  duration: number | null;
  /** The file aged out under the retention rule; the message remains. */
  expired: boolean;
  /** Private, membership-checked URL — needs the bearer token (see attachmentHeaders). */
  url: string | null;
  /** A picture of a PDF's first page, behind the same door as the file. Absent on older servers. */
  thumb_url?: string | null;
  /** What shows before opening it: counts, the first lines or cells, a photo's size. */
  meta?: ChatAttachmentMeta | null;
}

/** Read from the file at upload (server `ChatDocumentPreview`). Every field is optional. */
export interface ChatAttachmentMeta {
  pages?: number;
  sheets?: number;
  slides?: number;
  /** Photos: so the bubble keeps the picture's shape. */
  width?: number;
  height?: number;
  preview?: { kind: 'text'; lines: string[] } | { kind: 'sheet'; rows: string[][] } | null;
}

export interface ChatMessage {
  id: number;
  parent_id: number | null;
  kind: 'text' | ChatAttachmentKind;
  body: string | null;
  hidden: boolean;
  attachment: ChatAttachment | null;
  sender: ChatSender;
  created_at: string;
  /**
   * Who has read it: how many OTHER members' read cursor has passed this message, and whether
   * that is every one of them. Absent on older servers (then the tick stays single).
   */
  seen?: { count: number; all: boolean } | null;
  /** The message this one replies to (swipe-to-reply): who, and a line of what — null text when hidden. */
  reply_to?: ChatReplyRef | null;
  /** Reactions, grouped: emoji, how many, who. Absent on older servers. */
  reactions?: ChatReaction[];
  /**
   * CLIENT-ONLY. Set on a message the app has shown before the server confirmed it — the
   * bubble appears the instant you tap send, with a clock instead of the tick, and is
   * swapped for the real one when the reply lands. `failed` keeps the bubble on screen with
   * a retry, so nothing typed is ever silently lost to a bad network. The key is how the
   * optimistic row is found again; the id is a negative placeholder until then.
   */
  local?: { status: 'queued' | 'sending' | 'failed'; key: string };
}

export interface ChatReplyRef {
  id: number;
  sender_id: number;
  sender_name: string;
  kind: 'text' | ChatAttachmentKind;
  hidden: boolean;
  preview: string | null;
}

export interface ChatReaction {
  emoji: string;
  count: number;
  user_ids: number[];
}

/** The server's set (ChatService::REACTIONS) — a fixed, friendly set for a room of children. */
export const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

/** Socket settings from the server, or null → poll. Pusher and Reverb share the protocol. */
export interface ChatRealtime {
  driver: 'pusher' | 'reverb';
  key: string;
  cluster: string | null;
  host: string | null;
  port: number | null;
  tls: boolean;
  channel_prefix: string;
  auth_endpoint: string;
}

export interface ChatLimits {
  image_max_kb: number;
  file_max_kb: number;
  voice_max_seconds: number;
  /** Safety-net cadence, for once the private channel is actually subscribed. */
  poll_ms: number;
  /** Transport cadence until then, and whenever the socket drops. Absent on older servers. */
  poll_ms_fallback?: number;
}

export interface ChatMute {
  until: string;
  reason: string;
}

export interface ChatRoom {
  course: { id: number; name: string; teacher_name: string | null; members: number };
  role: 'teacher' | 'assistant' | 'student' | null;
  can_post: boolean;
  /** Why posting is refused right now — a full sentence to show as-is. */
  post_blocked_reason: string | null;
  locked: boolean;
  announcements_only: boolean;
  page_size: number;
  mute: ChatMute | null;
  report_reasons: Record<string, string>;
  /** Members this student has hidden — socket frames from them are dropped client-side. */
  blocked_user_ids: number[];
  realtime: ChatRealtime | null;
  limits: ChatLimits;
  messages: ChatMessage[];
  /** Members typing in the last few seconds, for a room without a socket (polled). */
  typing?: { user_id: number; name: string }[];
  /** Which slice this is (latest page, only-newer poll, or a window around a message). */
  window?: ChatWindow;
  /** The viewer's own messages read by someone / by everyone, up to these ids. */
  seen_upto?: { some: number; all: number };
  /** Withdrawn or removed in the last quarter hour — a polling client drops what it holds. */
  recent_hidden_ids?: number[];
  /** Reactions that changed lately on messages this poll did not resend: id → summary. */
  reaction_updates?: Record<string, ChatReaction[]>;
}

export interface ChatWindow {
  mode: 'latest' | 'after' | 'around';
  anchor_id?: number | null;
  has_more_before?: boolean;
  has_more_after?: boolean;
}

/** One slice of a room: the latest page, older than / newer than an id, or around an id or a day. */
export interface ChatRoomQuery {
  beforeId?: number;
  afterId?: number;
  aroundId?: number;
  /** YYYY-MM-DD, Cairo day. */
  aroundDate?: string;
}

export type ChatMediaType = 'media' | 'files' | 'voice' | 'links';

export interface ChatMediaPage {
  type: ChatMediaType;
  items: ChatMessage[];
  next_before_id: number | null;
}

export interface ChatMember {
  id: number;
  name: string;
  role: 'teacher' | 'assistant' | 'student';
  is_moderator: boolean;
  is_you: boolean;
  hidden_by_you: boolean;
  /** Moderators only. */
  mute?: { id: number; until: string; reason: string } | null;
  open_reports?: number;
  last_read_at?: string | null;
  messages_30d?: number;
}

export interface ChatInfo {
  course: { id: number; name: string; teacher_name: string | null };
  role: ChatRoom['role'];
  is_moderator: boolean;
  locked: boolean;
  announcements_only: boolean;
  notify: boolean;
  counts: { members: number; moderators: number } & Record<ChatMediaType, number>;
  first_message_at: string | null;
  /** Moderators only (null for a student). */
  open_reports: number | null;
  members: ChatMember[];
}

export interface ChatCalendar {
  from: string;
  to: string;
  /** YYYY-MM-DD → messages that day. */
  days: Record<string, number>;
  first: string | null;
  last: string | null;
}

export interface ChatChannelsResponse {
  realtime: ChatRealtime | null;
  channels: ChatChannelSummary[];
}

export async function getChatChannels(): Promise<ChatChannelSummary[]> {
  const { data } = await client.get('/chat/channels');
  return (data?.channels ?? []) as ChatChannelSummary[];
}

/**
 * Upload an image, document or voice note as a message (§8). Multipart; the server decides
 * the real type from the bytes, re-encodes images (EXIF gone) and applies the same posting
 * rules as text — a muted student cannot attach a photo either.
 */
export async function uploadChatAttachment(
  courseId: number,
  input: { kind: ChatAttachmentKind; uri: string; name: string; mime: string; duration?: number; body?: string; parentId?: number | null },
): Promise<ChatMessage> {
  const form = new FormData();
  form.append('kind', input.kind);
  if (input.parentId) form.append('parent_id', String(input.parentId));
  if (input.body) form.append('body', input.body);
  if (input.duration != null) form.append('duration', String(Math.round(input.duration)));
  // React Native's FormData takes {uri, name, type} for a file part.
  form.append('file', { uri: input.uri, name: input.name, type: input.mime } as unknown as Blob);
  const { data } = await client.post(`/chat/courses/${courseId}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return data.message as ChatMessage;
}

/**
 * Headers an <Image>, the audio player or a download needs to fetch a private attachment URL —
 * the bearer token, and on a staging build the staging door key too (without it the staging
 * server answers 404 and a voice note "sends but never plays", 2026-10-12).
 */
export async function attachmentHeaders(): Promise<Record<string, string>> {
  // Loaded on use (a lazy require, like the rest of the client): the keystore must not load
  // with the API module in tests or headless tasks.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  const token = await SecureStore.getItemAsync('access_token');
  const h: Record<string, string> = { Accept: '*/*' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (STAGING_KEY) h[STAGING_HEADER] = STAGING_KEY;
  return h;
}

/**
 * The name a file carries into the room when the source gave none worth keeping: a photo
 * from the camera roll arrives as `photo.jpg` (iOS) or a cache hash (Android), a voice note
 * as `voice.m4a`. WhatsApp-style stamped names tell them apart once they leave the chat
 * (founder 2026-10-12: «the filing system … file naming»). Documents keep their own name.
 */
export function attachmentFileName(kind: ChatAttachmentKind, original: string | null | undefined, ext: string, at: Date = new Date()): string {
  const keep = cleanAttachmentName(original ?? '');
  if (kind === 'file' && keep && !/^[0-9a-f-]{20,}\.[a-z0-9]+$/i.test(keep)) return keep;
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}_${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}`;
  const prefix = kind === 'image' ? 'IMG' : kind === 'voice' ? 'VOICE' : 'FILE';
  return `DrosSpot_${prefix}_${stamp}.${ext.replace(/^\./, '').toLowerCase() || 'bin'}`;
}

/**
 * A file name as a person would write it. The picker can hand back a percent-encoded name
 * (a file shared out of the iOS Files app arrives as «%E2%80%8E%E2%81%A8…pdf», bidi isolates
 * and all), and React Native's FormData encodes the multipart filename again on the way
 * up — the server decodes that side. Here: decode if it is encoded, drop the invisible
 * bidi/zero-width marks, collapse the spaces. The same rule, in the same words, as the
 * server's `ChatAttachmentService::cleanName`.
 */
export function cleanAttachmentName(raw: string): string {
  let name = raw;
  if (/%[0-9A-Fa-f]{2}/.test(name)) {
    try { name = decodeURIComponent(name); } catch { /* not really encoded — keep as is */ }
  }
  name = name.replace(/[​-‏‪-‮⁦-⁩﻿]/g, '');
  name = name.replace(/[\u0000-\u001F\u007F\\/]+/g, ' ');
  // iOS writes names decomposed (NFD: «إ» as alef + a combining hamza); compose them so the
  // same name is one string everywhere it is compared or searched.
  try { name = name.normalize('NFC'); } catch { /* older engines */ }
  return name.replace(/\s+/g, ' ').trim();
}

export async function getChatRoom(courseId: number, query?: number | ChatRoomQuery): Promise<ChatRoom> {
  const q: ChatRoomQuery = typeof query === 'number' ? { beforeId: query } : (query ?? {});
  const params: Record<string, string | number> = {};
  if (q.beforeId) params.before_id = q.beforeId;
  if (q.afterId) params.after_id = q.afterId;
  if (q.aroundId) params.around_id = q.aroundId;
  if (q.aroundDate) params.around_date = q.aroundDate;
  const { data } = await client.get(`/chat/courses/${courseId}/messages`, { params: Object.keys(params).length ? params : undefined });
  return data as ChatRoom;
}

/** One tab of the room's shelf, newest first. */
export async function getChatMedia(courseId: number, type: ChatMediaType, beforeId?: number): Promise<ChatMediaPage> {
  const { data } = await client.get(`/chat/courses/${courseId}/media`, { params: { type, ...(beforeId ? { before_id: beforeId } : {}) } });
  return data as ChatMediaPage;
}

/** The room's info page: members (moderators flagged), counts, switches. */
export async function getChatInfo(courseId: number): Promise<ChatInfo> {
  const { data } = await client.get(`/chat/courses/${courseId}/info`);
  return data as ChatInfo;
}

/** Messages per Cairo day between two dates (YYYY-MM-DD). */
export async function getChatCalendar(courseId: number, from: string, to: string): Promise<ChatCalendar> {
  const { data } = await client.get(`/chat/courses/${courseId}/calendar`, { params: { from, to } });
  return data as ChatCalendar;
}

/** Lift a mute early (moderators). */
export async function unmuteChatUser(muteId: number): Promise<void> {
  await client.delete(`/chat/mutes/${muteId}`);
}

/** «يكتب…» — fire and forget; the server answers 204 whether or not anyone is listening. */
export async function postChatTyping(courseId: number): Promise<void> {
  await client.post(`/chat/courses/${courseId}/typing`);
}

export async function sendChatMessage(courseId: number, body: string, parentId?: number | null): Promise<ChatMessage> {
  const { data } = await client.post(`/chat/courses/${courseId}/messages`, parentId ? { body, parent_id: parentId } : { body });
  return data.message as ChatMessage;
}

/** Set my reaction (or, with null, take it back). Answers with the message's new summary. */
export async function reactChatMessage(messageId: number, emoji: string | null): Promise<ChatReaction[]> {
  const { data } = emoji
    ? await client.post(`/chat/messages/${messageId}/reactions`, { emoji })
    : await client.delete(`/chat/messages/${messageId}/reactions`);
  return (data?.reactions ?? []) as ChatReaction[];
}

/** Withdraw one's own message. The server keeps the record; the room stops seeing it. */
export async function deleteChatMessage(messageId: number): Promise<void> {
  await client.delete(`/chat/messages/${messageId}`);
}

/** Returns the server's confirmation sentence. Deliberately no report id comes back. */
export async function reportChatMessage(messageId: number, reason: string, note?: string): Promise<string> {
  const { data } = await client.post(`/chat/messages/${messageId}/report`, { reason, note: note || undefined });
  return String(data?.message ?? '');
}

/** Hide another member's messages from MY view only. They are never told. */
export async function blockChatUser(courseId: number, userId: number): Promise<string> {
  const { data } = await client.post('/chat/blocks', { course_id: courseId, user_id: userId });
  return String(data?.message ?? '');
}

export async function unblockChatUser(userId: number): Promise<void> {
  await client.delete(`/chat/blocks/${userId}`);
}

/** Silence a course's pushes without leaving it. Reading is unaffected. */
export async function setChatNotify(courseId: number, notify: boolean): Promise<void> {
  await client.post(`/chat/courses/${courseId}/notifications`, { notify });
}

// ---------------------------------------------------------------------------
// Moderation — the teacher's side of the room, and a granted assistant's.
// Every one of these is refused server-side for anyone else; the client only
// hides the buttons so nobody is offered an action they cannot take.
// ---------------------------------------------------------------------------

export type ChatReportAction = 'dismiss' | 'warn' | 'remove' | 'mute' | 'escalate';

export interface ChatReport {
  id: number;
  reason: string;
  reason_label: string;
  note: string | null;
  /** What the message said WHEN reported — survives the sender deleting it. */
  captured_body: string | null;
  message_id: number | null;
  reported_user: { id: number; name: string } | null;
  reporter: { id: number | null; name: string | null };
  age_hours: number;
  late: boolean;
  created_at: string;
}

export interface ChatReportsResponse {
  reports: ChatReport[];
  actions: ChatReportAction[];
  mute_max_hours: number;
}

export async function getChatReports(courseId: number): Promise<ChatReportsResponse> {
  const { data } = await client.get(`/chat/courses/${courseId}/reports`);
  return data as ChatReportsResponse;
}

export async function resolveChatReport(
  reportId: number,
  payload: { action: ChatReportAction; note?: string; hours?: number; reason?: string },
): Promise<void> {
  await client.post(`/chat/reports/${reportId}/resolve`, payload);
}

/** Time-limited, reason required, parent notified — the server enforces all three (§3). */
export async function muteChatUser(courseId: number, userId: number, hours: number, reason: string): Promise<string> {
  const { data } = await client.post(`/chat/courses/${courseId}/mutes`, { user_id: userId, hours, reason });
  return String(data?.message ?? '');
}

export async function setChatSettings(courseId: number, settings: { is_locked?: boolean; announcements_only?: boolean }): Promise<void> {
  await client.post(`/chat/courses/${courseId}/settings`, settings);
}
