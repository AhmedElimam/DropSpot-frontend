import client from './client';
import { extractList, extractAttrs } from './utils';

export interface Notification {
  id: number;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export async function getNotifications(params?: { page?: number; per_page?: number }): Promise<Notification[]> {
  const { data } = await client.get('/notifications', { params });
  return extractList(data, 'notifications').map((item: any) => {
    const attrs = extractAttrs(item);
    return { id: parseInt(item.id, 10), ...attrs };
  });
}

export async function markRead(id: number): Promise<void> {
  await client.patch(`/notifications/${id}/read`);
}

/** Swipe back to unread. */
export async function markUnread(id: number): Promise<void> {
  await client.patch(`/notifications/${id}/unread`);
}

/** Swipe away — hidden from the feed (the server keeps the row). */
export async function dismissNotification(id: number): Promise<void> {
  await client.post(`/notifications/${id}/dismiss`);
}

/** «تراجع» after a swipe-away. */
export async function restoreNotification(id: number): Promise<void> {
  await client.post(`/notifications/${id}/restore`);
}

export async function markAllRead(): Promise<void> {
  await client.post('/notifications/read-all');
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await client.get('/notifications/unread-count');
  return data.data?.count ?? data.count ?? 0;
}

// ---------------------------------------------------------------------------
// Self-service notification preferences (Tier A).
// ---------------------------------------------------------------------------

export interface NotificationPrefs {
  push: boolean;   // all FCM pushes
  digest: boolean; // the periodic digest specifically
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const { data } = await client.get('/me/notification-preferences');
  const d = data.data ?? data;
  return { push: !!d.push, digest: !!d.digest };
}

export async function updateNotificationPrefs(prefs: NotificationPrefs): Promise<NotificationPrefs> {
  const { data } = await client.put('/me/notification-preferences', prefs);
  const d = data.data ?? data;
  return { push: !!d.push, digest: !!d.digest };
}
