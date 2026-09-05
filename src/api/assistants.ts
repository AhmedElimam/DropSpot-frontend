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
  /** How many OTHER teachers this person also assists. A count only — never names. */
  shared_with?: number;
  /** WHERE they work: true = everywhere, including venues added later. */
  all_venues?: boolean;
  /** The specific venues they cover when all_venues is false. */
  venue_ids?: number[];
}

export interface AssistantsData {
  assistants: ManagedAssistant[];
  all_abilities: AbilityDef[];
  /** Abilities that produce a file the assistant keeps after any later revocation. */
  takeaway_abilities?: string[];
  /** The teacher's venues. Empty = nothing to restrict, so the picker is hidden. */
  venues?: { id: number; name: string }[];
}

export async function getAssistants(): Promise<AssistantsData> {
  const { data } = await client.get('/assistants');
  return (data.data ?? { assistants: [], all_abilities: [], takeaway_abilities: [], venues: [] }) as AssistantsData;
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

/**
 * WHERE an assistant works. `all_venues: true` covers venues added later, so it clears
 * the specific list rather than snapshotting it. Outside their venues an assistant sees
 * no students, no dues, and can collect nothing.
 */
export async function setAssistantVenueScope(id: number, allVenues: boolean, venues: number[] = []): Promise<void> {
  await client.patch(`/assistants/${id}/venues`, { all_venues: allVenues, venues });
}
