import client from '@/api/client';
import type { FeatureTermsDoc } from '@/config/defaults';

/**
 * Feature agreements (backend App\Support\FeatureTerms): the add-on a feature brings when it
 * reaches someone. The due list rides /app-config (`feature_terms`); accepting stamps the
 * server's own version — the app only says «I accept».
 */
export async function acceptFeatureTerms(key: string): Promise<{ accepted: boolean; due: FeatureTermsDoc[] }> {
  const res = await client.post(`/feature-terms/${encodeURIComponent(key)}/accept`);
  const data = res.data?.data ?? {};
  return { accepted: !!data.accepted, due: Array.isArray(data.due) ? data.due : [] };
}
