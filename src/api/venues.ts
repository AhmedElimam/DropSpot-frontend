import client from './client';

/**
 * Teaching venues (أماكن التدريس) — a teacher's own named places.
 *
 * A venue is a NAME and the people who work it. It carries no coordinates and never
 * affects check-in; a course's GPS anchor is a separate, unrelated setting.
 */

export interface VenueAssistant {
  id: number;
  name: string;
}

export interface Venue {
  id: number;
  name: string;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  courses_count: number;
  assistants: VenueAssistant[];
}

export interface VenuesData {
  locations: Venue[];
  /** The teacher's own accepted assistants — the only people assignable to a venue. */
  assignable_assistants: VenueAssistant[];
}

export interface VenuePayload {
  name: string;
  address?: string | null;
  notes?: string | null;
}

export async function getVenues(): Promise<VenuesData> {
  const { data } = await client.get('/teacher/locations');
  return (data.data ?? { locations: [], assignable_assistants: [] }) as VenuesData;
}

export async function createVenue(payload: VenuePayload): Promise<Venue> {
  const { data } = await client.post('/teacher/locations', payload);
  return (data.data ?? {}) as Venue;
}

export async function updateVenue(id: number, payload: VenuePayload): Promise<Venue> {
  const { data } = await client.put(`/teacher/locations/${id}`, payload);
  return (data.data ?? {}) as Venue;
}

/** Pause or resume — keeps the venue and its history, just stops offering it. */
export async function toggleVenue(id: number): Promise<Venue> {
  const { data } = await client.post(`/teacher/locations/${id}/toggle`);
  return (data.data ?? {}) as Venue;
}

/** Deleting detaches its courses; they keep working exactly as before. */
export async function deleteVenue(id: number): Promise<void> {
  await client.delete(`/teacher/locations/${id}`);
}

/** Send the full list every time — an empty array clears everyone. */
export async function setVenueAssistants(id: number, assistants: number[]): Promise<Venue> {
  const { data } = await client.post(`/teacher/locations/${id}/assistants`, { assistants });
  return (data.data ?? {}) as Venue;
}
