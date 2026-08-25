import client from './client';

/**
 * Teacher oversight of an assistant's money actions (payment-proof approvals + pending
 * collections). Reject-only — the teacher can reverse an assistant's action within the
 * 30-day window; entries auto-clear after.
 */
export interface AssistantAction {
  id: number;
  kind: 'proof' | 'bill' | 'booklet' | 'booking';
  label: string | null;
  amount: number;
  assistant_name: string;
  created_at: string | null;
}

export async function getAssistantActions(): Promise<AssistantAction[]> {
  const { data } = await client.get('/teacher/assistant-actions');
  const rows = (data?.data ?? []) as any[];
  return rows.map((r) => (r.attributes ?? r) as AssistantAction);
}

export async function rejectAssistantAction(id: number): Promise<void> {
  await client.post(`/teacher/assistant-actions/${id}/reject`);
}
