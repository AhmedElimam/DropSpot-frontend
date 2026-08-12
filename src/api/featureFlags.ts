import client from './client';

export type FeatureFlags = Record<string, boolean>;

/** Global super-admin flags — used to hide gated entry points (e.g. revision scanning). */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  const { data } = await client.get('/feature-flags');
  return (data?.data ?? {}) as FeatureFlags;
}
