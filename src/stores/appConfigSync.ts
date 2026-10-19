import { useFeatureTermsStore } from '@/stores/featureTermsStore';
import * as SecureStore from 'expo-secure-store';
import i18n from '@/i18n';
import { getAppConfig } from '@/api/appConfig';
import { useAppConfigStore } from '@/stores/appConfigStore';
import { useAuthStore } from '@/stores/authStore';
import { ensureApiBaseHydrated, getApiBaseOverride, setApiBaseOverride } from '@/api/apiBase';
import { setErrorReportingEnabled } from '@/lib/errorReport';

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

/**
 * Who the next /app-config answer is FOR. The server resolves `feature_flags` and
 * `feature_beta` per user (feature-targeting contract 2026-10-15), so an answer that was
 * requested for one session must never be applied to another: the teacher's beta flags
 * landing a second after their assistant signed in on the same phone would hand the
 * assistant beta UI they do not have. Also carried: an assistant's active teacher context.
 */
export function sessionStamp(): string {
  const s = useAuthStore.getState();
  // Before the persisted session is read back (cold start) nobody has signed in or out:
  // a request sent now carries the stored token and answers for whoever hydration yields.
  if (s.isLoading) return 'pending';
  if (!s.isAuthenticated || !s.user) return 'anon';
  return `${s.user.id}:${s.impersonation?.active ? 'imp' : 'own'}:${s.activeTeacherId ?? ''}`;
}

/** A fetch whose session changed under it is retried for the new one, this many times at most. */
const STALE_RETRIES = 2;

async function fetchAndApply(): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const requestedFor = sessionStamp();
    const cfg = await getAppConfig();
    if (requestedFor !== 'pending' && sessionStamp() !== requestedFor) {
      // The person changed while the answer was in flight: this payload belongs to the
      // previous session. Fetch again for the current one (bounded), never apply it.
      if (attempt < STALE_RETRIES) continue;
      return;
    }
    useAppConfigStore.getState().setConfig(cfg);
    applyCopyOverlay(cfg.copy ?? {});
    setErrorReportingEnabled(cfg.error_reporting !== 'off');
    await reconcileApiBase(cfg.api_base_url);
    return;
  }
}

let inFlight: Promise<void> | null = null;
let lastSyncStartedAt = 0;

/**
 * Fetch /app-config and apply it. Silent no-op on failure (keeps last-good).
 * Call on cold start, after any session change and (throttled) on every app foreground.
 * Single-flight: callers that arrive during a run share it — the run re-fetches by itself
 * if the session changed under it (see fetchAndApply), so the shared result is always for
 * the current person.
 *
 * Failover recovery: if the request fails while an override is active, the override is
 * dropped and the fetch retried against the bundled URL — so an override that goes dark
 * can never permanently strand the app.
 */
export function syncAppConfig(): Promise<void> {
  if (inFlight) return inFlight;
  lastSyncStartedAt = Date.now();
  inFlight = (async () => {
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
  })().finally(() => { inFlight = null; });
  return inFlight;
}

/**
 * Returning to the app refetches the per-user flags (a beta the super-admin just opened
 * for this teacher appears without a relaunch), coalesced: a teacher who switches apps
 * twenty times in a minute pays for one request (founder 2026-10-09: «light on all
 * devices»). The server throttles it too; the payload is small.
 *
 * Five minutes, not one (2026-10-19 staging audit: «the app isn't optimised like
 * production»): every sync replaced the whole config and re-rendered every screen that
 * reads a flag or a surface, ~116 of them across the preloaded tabs. A beta opened for a
 * teacher still lands within five minutes, at once on a sign-in or a teacher switch.
 */
export const FOREGROUND_CONFIG_GAP_MS = 5 * 60_000;

export function syncAppConfigOnForeground(now: number = Date.now()): Promise<void> | null {
  if (inFlight || now - lastSyncStartedAt < FOREGROUND_CONFIG_GAP_MS) return null;
  return syncAppConfig();
}

/**
 * React to the session changing — sign-in, sign-out, entering or leaving impersonation,
 * an assistant switching teacher context — the ONE place that keeps the per-user flags in
 * step with who is signed in:
 *  - sign-out: the per-user flags and beta keys go back to the bundled defaults
 *    IMMEDIATELY (another person on this phone must not inherit beta UI, not even for the
 *    length of a request), then the global map is fetched anonymously;
 *  - anything else: refetch for the new person.
 * Returns the unsubscribe. Idempotent per subscription; mount it once (AppConfigGate).
 */
export function watchSessionForConfig(): () => void {
  let previous = sessionStamp();
  return useAuthStore.subscribe(() => {
    const next = sessionStamp();
    if (next === previous) return;
    const wasPending = previous === 'pending';
    previous = next;
    if (next === 'pending') return;
    if (next === 'anon') {
      // A sign-out — or a cold start that found no session: nothing of a person may stay.
      useAppConfigStore.getState().resetUserFlags();
      useFeatureTermsStore.getState().reset();
      void syncAppConfig();
      return;
    }
    // Another person on this phone (a switch): their «لاحقًا» choices are not this one's.
    useFeatureTermsStore.getState().reset();
    // Hydration handed back the persisted session: the start-up fetch already carries its
    // token, so this is not a switch and costs no second request.
    if (wasPending) return;
    void syncAppConfig();
  });
}

/** Tests only: forget the single-flight and the foreground clock. */
export function __resetSyncStateForTests(): void {
  inFlight = null;
  lastSyncStartedAt = 0;
}
