import client from './client';

/**
 * «حصة أونلاين» (remote session) — a live class in our own room. The room is a web page served
 * by the backend; the app only asks for a short-lived `join_url` and opens it full screen
 * (src/components/remote/RemoteRoomScreen.tsx). Every endpoint is behind the `remote_sessions`
 * feature flag on the server; callers gate on it (src/hooks/useRemoteSession.ts).
 *
 * A `join_url` is single-use and good for about two minutes: ask for it at the moment of
 * opening, never keep it (no query cache, no storage, no route param).
 */

/** On a teacher's session row (`/teacher/sessions/today`, `/teacher/sessions/{id}`). Absent/null = feature off for this teacher. */
export interface TeacherRemoteState {
  live: boolean;
  /** Students watching right now. */
  viewers: number;
}

/** On a student's session row (`/students/{id}/sessions/today` and `/upcoming`). Absent/null = feature off for that teacher. */
export interface StudentRemoteState {
  live: boolean;
}

export interface RemoteRoom {
  live: boolean;
  started_at: string | null;
  ended_at?: string | null;
}

export interface RemoteViewer {
  student_id: number;
  name: string;
  watched_minutes: number;
  online: boolean;
  /** Attendance was recorded by the system after watching long enough. */
  checked_in: boolean;
}

export interface RemoteRoomStatus {
  room: RemoteRoom;
  /** Minutes of watching after which the system records attendance. */
  needed_minutes: number;
  viewers: RemoteViewer[];
}

/** Machine codes the server puts beside its Arabic `message`. */
export type RemoteErrorCode = 'REMOTE_NOT_CONFIGURED' | 'REMOTE_NOT_LIVE' | 'BILLING_BLOCKED' | (string & {});

type Id = string | number;

/** The paths, in one place (and under test): a typo here is a class that does not open. */
export const remotePaths = {
  teacherStart: (sessionId: Id) => `/teacher/sessions/${encodeURIComponent(String(sessionId))}/remote/start`,
  teacherJoin: (sessionId: Id) => `/teacher/sessions/${encodeURIComponent(String(sessionId))}/remote/join`,
  teacherEnd: (sessionId: Id) => `/teacher/sessions/${encodeURIComponent(String(sessionId))}/remote/end`,
  teacherStatus: (sessionId: Id) => `/teacher/sessions/${encodeURIComponent(String(sessionId))}/remote`,
  studentJoin: (studentId: Id, sessionId: Id) =>
    `/students/${encodeURIComponent(String(studentId))}/sessions/${encodeURIComponent(String(sessionId))}/remote/join`,
} as const;

/** The house envelope is `{ data: … }`; a bare body is read as it is. */
function unwrap<T>(body: any): T {
  return (body && typeof body === 'object' && body.data && typeof body.data === 'object' ? body.data : body) as T;
}

/** A join answer without a usable link is a failure, not a blank page. */
function joinUrlOf(body: any): string {
  const url = unwrap<{ join_url?: unknown }>(body)?.join_url;
  if (typeof url !== 'string' || url.length === 0) throw new Error('remote: no join_url in the answer');
  return url;
}

/** Starts the room and notifies the students. Answers with the teacher's own way in. */
export async function startRemoteSession(sessionId: Id): Promise<{ join_url: string; room: RemoteRoom }> {
  const { data } = await client.post(remotePaths.teacherStart(sessionId));
  const d = unwrap<{ room?: Partial<RemoteRoom> }>(data);
  return { join_url: joinUrlOf(data), room: { live: true, started_at: d?.room?.started_at ?? null } };
}

/** The teacher's way back into a room that is on air (409 `REMOTE_NOT_LIVE` otherwise). */
export async function joinRemoteSessionAsTeacher(sessionId: Id): Promise<string> {
  const { data } = await client.post(remotePaths.teacherJoin(sessionId));
  return joinUrlOf(data);
}

/** Ends the class for everyone. */
export async function endRemoteSession(sessionId: Id): Promise<RemoteRoom> {
  const { data } = await client.post(remotePaths.teacherEnd(sessionId));
  const room = unwrap<{ room?: Partial<RemoteRoom> }>(data)?.room;
  return { live: false, started_at: room?.started_at ?? null, ended_at: room?.ended_at ?? null };
}

/** Who watched, for how long, and whose attendance the system recorded. */
export async function getRemoteSessionStatus(sessionId: Id): Promise<RemoteRoomStatus> {
  const { data } = await client.get(remotePaths.teacherStatus(sessionId));
  const d = unwrap<Partial<RemoteRoomStatus>>(data) ?? {};
  return {
    room: { live: !!d.room?.live, started_at: d.room?.started_at ?? null, ended_at: d.room?.ended_at ?? null },
    needed_minutes: Number(d.needed_minutes) || 0,
    viewers: Array.isArray(d.viewers) ? d.viewers : [],
  };
}

/** A student's way in — or a parent's, with the child's student id. */
export async function joinRemoteSessionAsStudent(studentId: Id, sessionId: Id): Promise<string> {
  const { data } = await client.post(remotePaths.studentJoin(studentId, sessionId));
  return joinUrlOf(data);
}

/**
 * The server's own Arabic sentence on a refused call, whatever the status (the room's refusals
 * come as 403, 409, 422 and 503 — «البث لسه مش متجهّز» is a 503, which the general error
 * mapper would flatten into «server error»). Null when there is none: the caller then falls
 * back to the general mapper. Never a raw non-Arabic string.
 */
export function remoteErrorSentence(error: unknown): string | null {
  const res = (error as { response?: { status?: number; data?: { message?: unknown } } } | null)?.response;
  if (!res || res.status === 401) return null;
  const msg = res.data?.message;
  return typeof msg === 'string' && msg.length > 0 && msg.length < 300 && /[؀-ۿ]/.test(msg) ? msg : null;
}

/** The server's machine code on a refused call (`REMOTE_NOT_LIVE`, `REMOTE_NOT_CONFIGURED`, `BILLING_BLOCKED`…), else null. */
export function remoteErrorCode(error: unknown): RemoteErrorCode | null {
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code;
  return typeof code === 'string' && code.length > 0 ? code : null;
}
