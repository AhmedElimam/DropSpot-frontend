import client from './client';
import { homePart } from '@/api/homeBatch';

/**
 * Teacher oversight of an assistant's money actions (payment-proof approvals + pending
 * collections) and attendance changes. The teacher accepts one (it stands) or rejects it (it is
 * reversed) within 10 days (30 until 2026-11-03); entries auto-clear after and the action stands.
 */
export interface AssistantAction {
  id: number;
  /** `attendance` = an assistant changed a recorded status (or recorded an ended session). */
  kind: 'proof' | 'bill' | 'booklet' | 'booking' | 'attendance';
  label: string | null;
  amount: number;
  student_id?: number | null;
  assistant_id?: number | null;
  assistant_name: string;
  created_at: string | null;
}

export async function getAssistantActions(): Promise<AssistantAction[]> {
  const data = await homePart('assistant_actions', () => client.get('/teacher/assistant-actions').then((r) => r.data));
  const rows = (data?.data ?? []) as any[];
  // JSON:API: the id sits beside `attributes`, not inside it — reading attributes alone
  // left every row without an id (no React key, and «رفض» posted to /undefined).
  return rows.map((r) => ({ ...(r.attributes ?? r), id: Number(r.id ?? r.attributes?.id) }) as AssistantAction);
}

/** «قبول» — the action stands as the assistant left it and leaves the bucket. */
export async function acceptAssistantAction(id: number): Promise<void> {
  await client.post(`/teacher/assistant-actions/${id}/accept`);
}

export async function rejectAssistantAction(id: number): Promise<void> {
  await client.post(`/teacher/assistant-actions/${id}/reject`);
}
