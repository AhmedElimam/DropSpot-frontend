import client from './client';

export interface FeedSession {
  session_instance_id: string;
  course_name?: string;
  status?: string | null;
  note?: string | null;
  scheduled_at?: string;
}

export interface FeedTeacher {
  teacher_id: string;
  teacher_name?: string | null;
  sessions: FeedSession[];
}

export interface FeedChild {
  id: string;
  name: string;
  teachers: FeedTeacher[];
}

export interface TodayFeed {
  date: string;
  children: FeedChild[];
}

/**
 * Parent "today" feed (§2) — a LIVE per-child, per-teacher view of today's sessions
 * with current attendance status and the parent-facing note. Distinct from the
 * frozen daily-digest notification.
 */
export async function getTodayFeed(): Promise<TodayFeed> {
  const { data } = await client.get('/parents/feed');
  const payload = data?.data ?? data ?? {};
  return { date: payload.date ?? '', children: payload.children ?? [] };
}
