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

export async function markAllRead(): Promise<void> {
  await client.post('/notifications/read-all');
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await client.get('/notifications/unread-count');
  return data.data?.count ?? data.count ?? 0;
}
