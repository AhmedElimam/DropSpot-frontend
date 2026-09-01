import client from './client';

/**
 * Tier A — a parent edits their OWN display name directly (self-owned account). A student's
 * name is a reviewed request instead (see submitMyNameCorrection in api/students).
 */
export async function updateMyName(payload: { first_name: string; last_name?: string }): Promise<{ name: string }> {
  const { data } = await client.put('/me/name', payload);
  return (data.data ?? {}) as { name: string };
}
