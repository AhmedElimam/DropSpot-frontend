import client from './client';

/**
 * Session relocation: when a teacher connects from a new IP (likely a new venue), the
 * app offers to update ALL their course geofence anchors to the current GPS. IP is only
 * the trigger — coordinates come from expo-location on confirm.
 */

export async function checkRelocation(): Promise<boolean> {
  const { data } = await client.get('/teacher/location/relocation-check');
  return !!(data.data ?? data)?.needs_relocation;
}

export async function dismissRelocation(): Promise<void> {
  await client.post('/teacher/location/dismiss');
}

export interface RelocatePayload {
  latitude: number;
  longitude: number;
  location_accuracy_meters?: number;
  location_source?: 'gps' | 'gps_low' | 'manual';
}

export async function relocateAll(payload: RelocatePayload): Promise<number> {
  const { data } = await client.post('/teacher/location/relocate-all', payload);
  return Number((data.data ?? data)?.count ?? 0);
}
