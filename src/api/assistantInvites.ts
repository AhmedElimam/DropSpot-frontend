import client from './client';

// Assistant consent surface: pending invitations to work for a teacher + accept/reject.

export interface AssistantInvite {
  id: number;
  teacher_id: number;
  teacher_name: string | null;
  abilities: string[];
}

export async function getPendingInvitations(): Promise<AssistantInvite[]> {
  const { data } = await client.get('/assistant/invitations');
  return (data.data ?? []) as AssistantInvite[];
}

export async function acceptInvitation(id: number): Promise<void> {
  await client.post(`/assistant/invitations/${id}/accept`);
}

export async function rejectInvitation(id: number): Promise<void> {
  await client.post(`/assistant/invitations/${id}/reject`);
}
