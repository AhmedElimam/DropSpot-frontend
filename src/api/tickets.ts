import client from './client';
import { extractList, extractAttrs } from './utils';

export interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  student_name: string;
  teacher_name: string;
  parent_name?: string;
  message_count?: number;
  last_message_at?: string;
  created_at: string;
  resolved_at?: string | null;
}

export interface TicketMessage {
  id: number;
  user_id: number;
  user_name: string;
  user_role: string;
  message: string;
  created_at: string;
}

export interface TicketDetail extends Ticket {
  description?: string;
  teacher_phone?: string | null;
  messages: TicketMessage[];
}

export interface TeacherInfo {
  id: string;
  name: string;
  phone?: string | null;
}

export async function getTickets(): Promise<Ticket[]> {
  const { data } = await client.get('/tickets');
  return extractList(data, 'tickets').map((item: any) => {
    const attrs = extractAttrs(item);
    return { id: item.id, ...attrs };
  });
}

export async function getTicket(id: string): Promise<TicketDetail> {
  const { data } = await client.get(`/tickets/${id}`);
  const item = extractAttrs(data.data ?? data);
  return item;
}

export async function createTicket(payload: {
  student_id: number;
  teacher_id: number;
  subject: string;
  description: string;
}) {
  const { data } = await client.post('/tickets', payload);
  return data;
}

export async function addMessage(ticketId: string, message: string) {
  const { data } = await client.post(`/tickets/${ticketId}/messages`, { message });
  return data;
}

export async function updateTicketStatus(ticketId: string, status: string) {
  const { data } = await client.patch(`/tickets/${ticketId}/status`, { status });
  return data;
}

export async function getStudentTeachers(studentId: number): Promise<TeacherInfo[]> {
  const { data } = await client.get(`/students/${studentId}/teachers`);
  return extractList(data, 'teachers').map((item: any) => {
    const attrs = extractAttrs(item);
    return { id: item.id, ...attrs };
  });
}
