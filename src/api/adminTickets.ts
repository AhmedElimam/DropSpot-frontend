import client from './client';

/**
 * General teacher→super-admin ticket channel (Resolution Center "مراسلة الإدارة").
 * Student-agnostic escalation: the teacher composes; every super-admin is notified;
 * the author tracks status here.
 */

export interface AdminTicket {
  id: number;
  subject: string;
  message: string;
  category: string | null;
  status: 'open' | 'resolved';
  admin_note: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

export async function getMyAdminTickets(): Promise<AdminTicket[]> {
  const { data } = await client.get('/teacher/admin-tickets');
  return (data.data ?? data ?? []) as AdminTicket[];
}

export async function createAdminTicket(payload: { subject: string; message: string; category?: string }): Promise<AdminTicket> {
  const { data } = await client.post('/teacher/admin-tickets', payload);
  return (data.data ?? data) as AdminTicket;
}
