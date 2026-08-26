import client from './client';
import { BUNDLED_API_URL } from './client';
import { getApiBaseOverride } from './apiBase';

export type TermsRole = 'student' | 'parent' | 'teacher';

/**
 * The public web URL of the binding Terms full text for a role. Derived from the
 * effective API base (override or bundled) by stripping the `/api/v1` suffix — the
 * pages live at the site root (`/terms/{role}`), like `/privacy`.
 */
export function termsUrl(role: TermsRole): string {
  const base = getApiBaseOverride() ?? BUNDLED_API_URL;
  const root = base.replace(/\/api\/v1\/?$/, '');
  return `${root}/terms/${role}`;
}

/** Accept the current Terms (in-app blocking gate). Backend stamps its own version. */
export async function acceptTerms(): Promise<void> {
  await client.post('/terms/accept');
}
