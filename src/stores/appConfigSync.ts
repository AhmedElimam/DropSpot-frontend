import * as SecureStore from 'expo-secure-store';
import i18n from '@/i18n';
import { getAppConfig } from '@/api/appConfig';
import { useAppConfigStore } from '@/stores/appConfigStore';
import { ensureApiBaseHydrated, getApiBaseOverride, setApiBaseOverride } from '@/api/apiBase';

/** Apply the curated copy overlay onto i18n (dotted keys handled by addResource). */
function applyCopyOverlay(copy: Record<string, string>): void {
  for (const [key, value] of Object.entries(copy ?? {})) {
    try {
      i18n.addResource('ar', 'translation', key, value);
    } catch {
      // A malformed key must never break the overlay for the rest.
    }
  }
}

/**
 * Health-check a candidate API base before adopting it: it must return our /app-config
 * shape within a short timeout. Anything else (unreachable, wrong host, error) → false,
 * so a bad URL is never adopted. Never throws.
 */
async function isReachable(base: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    let token: string | null = null;
    try { token = await SecureStore.getItemAsync('access_token'); } catch { token = null; }
    const res = await fetch(`${base.replace(/\/$/, '')}/app-config`, {
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const json = await res.json();
    return json?.data?.schema_version != null;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reconcile the remote API-base override with what the server now advertises:
 *  - empty/absent  → clear any override (revert to the bundled URL)
 *  - a NEW url      → adopt ONLY if it passes the health-check
 *  - unchanged      → nothing to do
 */
async function reconcileApiBase(desiredRaw?: string): Promise<void> {
  const desired = (desiredRaw ?? '').trim() || null;
  const current = getApiBaseOverride();
  if (desired === current) return;
  if (!desired) {
    await setApiBaseOverride(null);
    return;
  }
  if (await isReachable(desired)) {
    await setApiBaseOverride(desired);
  }
  // else: keep the current base — never adopt an unreachable URL.
}

async function fetchAndApply(): Promise<void> {
  const cfg = await getAppConfig();
  useAppConfigStore.getState().setConfig(cfg);
  applyCopyOverlay(cfg.copy ?? {});
  await reconcileApiBase(cfg.api_base_url);
}

/**
 * Fetch /app-config and apply it. Silent no-op on failure (keeps last-good).
 * Call on cold start and on every app foreground.
 *
 * Failover recovery: if the request fails while an override is active, the override is
 * dropped and the fetch retried against the bundled URL — so an override that goes dark
 * can never permanently strand the app.
 */
export async function syncAppConfig(): Promise<void> {
  await ensureApiBaseHydrated();
  try {
    await fetchAndApply();
  } catch {
    if (getApiBaseOverride()) {
      // The adopted override is unreachable — fall back to the bundled URL and retry.
      await setApiBaseOverride(null);
      try {
        await fetchAndApply();
      } catch {
        // Still down — a no-op; the app keeps last-good config on the bundled base.
      }
    }
    // No override → normal offline/down case; keep last-good, never surface.
  }
}
