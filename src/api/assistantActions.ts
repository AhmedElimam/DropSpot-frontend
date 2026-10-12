import client from './client';

/**
 * Teacher oversight of an assistant's money actions (payment-proof approvals + pending
 * collections) and attendance changes. Reject-only — the teacher can reverse an assistant's action within the
 * 30-day window; entries auto-clear after.
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
  const { data } = await client.get('/teacher/assistant-actions');
  const rows = (data?.data ?? []) as any[];
  // JSON:API: the id sits beside `attributes`, not inside it — reading attributes alone
  // left every row without an id (no React key, and «رفض» posted to /undefined).
  return rows.map((r) => ({ ...(r.attributes ?? r), id: Number(r.id ?? r.attributes?.id) }) as AssistantAction);
}

export async function rejectAssistantAction(id: number): Promise<void> {
  await client.post(`/teacher/assistant-actions/${id}/reject`);
}
