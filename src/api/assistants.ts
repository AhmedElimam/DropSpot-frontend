import client from './client';

// Teacher-only assistant management (mirrors the dashboard).

export interface AbilityDef {
  key: string;
  label: string;
}

export interface ManagedAssistant {
  id: number;
  name: string | null;
  phone: string | null;
  status: string; // pending | accepted | rejected
  is_active: boolean;
  abilities: string[];
}

export interface AssistantsData {
  assistants: ManagedAssistant[];
  all_abilities: AbilityDef[];
}

export async function getAssistants(): Promise<AssistantsData> {
  const { data } = await client.get('/assistants');
  return (data.data ?? { assistants: [], all_abilities: [] }) as AssistantsData;
}

export async function inviteAssistant(phone_number: string): Promise<void> {
  await client.post('/assistants/invite', { phone_number });
}

export async function createAssistant(payload: {
  first_name: string;
  last_name?: string;
  phone_number: string;
  password: string;
}): Promise<void> {
  await client.post('/assistants', payload);
}

export async function updateAssistantAbilities(id: number, abilities: string[]): Promise<void> {
  await client.patch(`/assistants/${id}/abilities`, { abilities });
}

export async function toggleAssistant(id: number): Promise<void> {
  await client.post(`/assistants/${id}/toggle`);
}
