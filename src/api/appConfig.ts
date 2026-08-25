import client from './client';
import type { AppConfigPayload } from '@/config/defaults';

/** The single backend-driven config payload (flags + rules + copy + pricing + min version). */
export async function getAppConfig(): Promise<AppConfigPayload> {
  const { data } = await client.get('/app-config');
  return (data?.data ?? {}) as AppConfigPayload;
}
