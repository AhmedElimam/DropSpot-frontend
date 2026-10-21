import client from './client';
import { homePart } from '@/api/homeBatch';
import { extractList, extractAttrs } from './utils';

export interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  student_id?: number;
  student_name: string;
  teacher_name: string;
  parent_name?: string;
  message_count?: number;
  last_message_at?: string;
  created_at: string;
  resolved_at?: string | null;
}

/** A file on a message: a photo or PDF someone attached, or the student's report the server produced. */
export interface TicketAttachment {
  id: number;
  kind: 'file' | 'student_report';
  name: string;
  mime: string;
  size: number;
  is_image: boolean;
  /** A signed link that opens the file for ~30 minutes with no login. */
  url: string;
}

export interface TicketMessage {
  id: number;
  user_id: number;
  user_name: string;
  user_role: string;
  message: string;
  attachments?: TicketAttachment[];
  created_at: string;
}

export interface TicketDetail extends Ticket {
  description?: string;
  teacher_phone?: string | null;
  student_id?: number;
  /** Staff may send the student's performance report into the thread. */
  can_send_report?: boolean;
  /** Only staff set the status; a parent answers (older servers omit it). */
  can_change_status?: boolean;
  /** The teacher's side opened this ticket with the parent. */
  opened_by_teacher?: boolean;
  messages: TicketMessage[];
}

/** A file picked on the phone, before upload. */
export interface PendingFile {
  uri: string;
  name: string;
  mime: string;
  size?: number;
  isImage: boolean;
}

export const TICKET_MAX_FILES = 3;
export const TICKET_MAX_MB = 8;

export interface TeacherInfo {
  id: string;
  name: string;
  phone?: string | null;
}

export async function getTickets(): Promise<Ticket[]> {
  const data = await homePart('tickets', () => client.get('/tickets').then((r) => r.data));
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

/**
 * Teacher or assistant: a ticket with one of the student's parents (the primary one when
 * `parent_id` is left out). `parent_reached_by` says how the parent hears: the app, or one
 * SMS with the activation link when they never activated.
 */
export async function openTicketWithParent(payload: {
  student_id: number;
  parent_id?: number;
  subject: string;
  description: string;
}): Promise<{ id: string; parent_name?: string | null; parent_reached_by?: 'app' | 'sms' }> {
  const { data } = await client.post('/tickets', payload);
  const node = data?.data ?? data;
  return { id: String(node?.id ?? ''), ...extractAttrs(node) };
}

export async function addMessage(ticketId: string, message: string, files: PendingFile[] = []) {
  if (!files.length) {
    const { data } = await client.post(`/tickets/${ticketId}/messages`, { message });
    return data;
  }
  // Multipart: the message (may be empty when only files go) and up to TICKET_MAX_FILES files.
  const form = new FormData();
  form.append('message', message);
  for (const f of files.slice(0, TICKET_MAX_FILES)) {
    form.append('files[]', { uri: f.uri, name: f.name, type: f.mime } as unknown as Blob);
  }
  const { data } = await client.post(`/tickets/${ticketId}/messages`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 });
  return data;
}

/** The teacher sends the student's performance report into the thread (no download on either side). */
export async function sendStudentReport(ticketId: string) {
  const { data } = await client.post(`/tickets/${ticketId}/report`, {}, { timeout: 60_000 });
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
