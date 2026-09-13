import client from './client';

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
}

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
  poll_ms: number;
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
  input: { kind: ChatAttachmentKind; uri: string; name: string; mime: string; duration?: number; body?: string },
): Promise<ChatMessage> {
  const form = new FormData();
  form.append('kind', input.kind);
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

/** Headers an <Image> or a download needs to fetch a private attachment URL. */
export async function attachmentHeaders(): Promise<Record<string, string>> {
  const SecureStore = await import('expo-secure-store');
  const token = await SecureStore.getItemAsync('access_token');
  return token ? { Authorization: `Bearer ${token}`, Accept: '*/*' } : { Accept: '*/*' };
}

export async function getChatRoom(courseId: number, beforeId?: number): Promise<ChatRoom> {
  const { data } = await client.get(`/chat/courses/${courseId}/messages`, {
    params: beforeId ? { before_id: beforeId } : undefined,
  });
  return data as ChatRoom;
}

export async function sendChatMessage(courseId: number, body: string): Promise<ChatMessage> {
  const { data } = await client.post(`/chat/courses/${courseId}/messages`, { body });
  return data.message as ChatMessage;
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
