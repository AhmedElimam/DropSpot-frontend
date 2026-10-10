import { track } from '@/lib/analytics';
import axios, { type InternalAxiosRequestConfig } from 'axios';
import { uuid } from '@/utils/uuid';
import { matchQueueRule, parkedBody, queuedLabel, syntheticQueuedResponse } from './offlineQueue';
import { enqueueAction } from '@/db/outbox';
import { useOfflineStore } from '@/stores/offlineStore';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore, resolveRole } from '@/stores/authStore';
import { ensureApiBaseHydrated, getApiBaseOverride } from '@/api/apiBase';
import { getCachedAccessToken, setCachedAccessToken } from '@/api/tokenCache';
import { resolveAppId } from '@/utils/appIdentity';

/**
 * Resolve the API base URL.
 *
 * `localhost` / `0.0.0.0` point at the DEVICE, not the dev machine, so they never
 * work from a phone or Android emulator. In development we derive the dev
 * machine's address from the Metro bundler host the device is already talking to
 * (Constants.expoConfig.hostUri, e.g. "192.168.1.50:8081") and target port 8000
 * there. On the Android emulator the host loopback is reachable as 10.0.2.2.
 * An explicit EXPO_PUBLIC_API_URL always wins (use it for real builds).
 *
 * NOTE: the Laravel server must be reachable at that host — run it with
 * `php artisan serve --host 0.0.0.0 --port 8000` and keep the device on the same
 * Wi-Fi as the dev machine.
 */
/** Production API — every released (non-dev) build talks to this. */
const PRODUCTION_API_URL = 'https://drosspot.app/api/v1';

function resolveApiUrl(): string {
  // An explicit override always wins (staging, a custom backend, etc.).
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Any release build (store/TestFlight/APK) → production. The dev LAN/emulator
  // auto-detection below only applies while running under Metro (__DEV__).
  if (!__DEV__) {
    return PRODUCTION_API_URL;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants.expoGoConfig as any)?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    '';

  const host = hostUri.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0') {
    return `http://${host}:8000/api/v1`;
  }

  // Android emulator: the host machine's loopback is aliased to 10.0.2.2.
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }

  // iOS simulator / web fallback (shares the dev machine's network).
  return 'http://localhost:8000/api/v1';
}

const API_URL = resolveApiUrl();

/** The build-time (bundled) API URL — the safe fallback the app can always reach. */
export const BUNDLED_API_URL = API_URL;

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[api] baseURL =', API_URL);
}

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  // 15 s, not 30: on a weak link every screen and every button waited half a minute
  // before admitting it (founder 2026-10-10: the demo stalled «loading» on a bad
  // connection). The shared host's cold warm-up that once needed 30 s is covered by the
  // query retry in app/_layout.tsx instead.
  timeout: 15000,
});

client.interceptors.request.use(async (config) => {
  // Effective base URL = the super-admin remote override (once safely adopted) else
  // the bundled URL. Read per-request so a runtime failover takes effect immediately.
  try {
    await ensureApiBaseHydrated();
    config.baseURL = getApiBaseOverride() ?? BUNDLED_API_URL;
  } catch {
    config.baseURL = BUNDLED_API_URL;
  }
  // A transient SecureStore/keystore read failure (seen on some Android devices
  // right after a cold boot) must not reject the whole request — fall through
  // unauthenticated and let the 401 refresh path handle it, rather than surfacing
  // a network error / reload screen.
  // Read the keystore ONCE per process; every later request takes the in-memory copy.
  let token: string | null | undefined = getCachedAccessToken();
  if (token === undefined) {
    try {
      token = await SecureStore.getItemAsync('access_token');
    } catch {
      token = null;
    }
    if (token !== null) setCachedAccessToken(token);
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // App version for server-side observability (never a hard gate — the blocking
  // update screen is enforced client-side against the shipped binary version).
  const appVersion = Constants.expoConfig?.version;
  if (appVersion) config.headers['X-App-Version'] = appVersion;
  // App IDENTITY (bundle id / package name) + platform. This is what lets the server
  // retire ONE published app — the one on a developer account we share — while the
  // successor app keeps working. Builds shipped before this header existed send
  // nothing, and the server reads a missing header as the legacy identity.
  const appId = resolveAppId();
  if (appId) config.headers['X-App-Id'] = appId;
  config.headers['X-App-Platform'] = Platform.OS;

  // Every write carries a one-time key: the server answers a repeat of the same key from
  // memory instead of running it twice (a payment collected once, however many retries).
  const method = (config.method ?? 'get').toLowerCase();
  if (method !== 'get' && method !== 'head' && !config.headers['X-Idempotency-Key']) {
    config.headers['X-Idempotency-Key'] = uuid();
  }
  // Actions that may wait on the phone (src/api/offlineQueue.ts). With no connection, or
  // right after a request dropped, they are parked at once — no 15 s wait on a dead radio.
  // Teacher and assistant only: their app is the one that replays the outbox (the teacher
  // layout opens it and runs the sync). A parent's request parked here would never be sent.
  const role = useAuthStore.getState().role;
  if (!config.__replay && (role === 'teacher' || role === 'assistant')) {
    const rule = matchQueueRule(method, config.url);
    if (rule) {
      config.__queueRule = rule;
      const net = useOfflineStore.getState();
      if (!net.online || net.weak) {
        await parkRequest(config);
        config.adapter = () => Promise.resolve(syntheticQueuedResponse(config));
      }
    }
  }
  return config;
});

/** Store the request for replay and tell the person it is saved. */
async function parkRequest(config: InternalAxiosRequestConfig): Promise<void> {
  const body = parkedBody(config.__queueRule!, config.data);
  const label = queuedLabel(config.__queueRule!, body);
  await enqueueAction({
    key: String(config.headers['X-Idempotency-Key']),
    method: (config.method ?? 'post').toLowerCase(),
    url: String(config.url),
    body,
    label,
    teacher_id: useAuthStore.getState().activeTeacherId ?? null,
  });
  useOfflineStore.getState().noteQueued(label);
  track('offline_action_queued', { action: config.__queueRule!.label });
}

// Single-flight token refresh. When the access token has expired, an app open/resume
// fires several requests at once and they ALL 401. Without a shared refresh, each one
// POSTs /auth/refresh with the same refresh token; the server rotates (revokes) it on
// the first call, so every other concurrent refresh replays a now-revoked token, fails,
// and forces a logout. Funnelling every 401 through ONE in-flight refresh promise means
// the rotated token is used exactly once — no race, no spurious sign-out.
let refreshPromise: Promise<string | null> | null = null;

/**
 * Thrown when the refresh itself couldn't complete for a NON-auth reason (network
 * down, timeout, 5xx). The session is NOT over — we must not sign the user out;
 * the next request simply retries. Distinct from a genuine auth failure (missing or
 * server-rejected refresh token), which returns null and DOES end the session.
 */
class TransientRefreshError extends Error {}

async function refreshAccessToken(): Promise<string | null> {
  const rt = await SecureStore.getItemAsync('refresh_token');
  if (!rt) return null; // no refresh token → session genuinely over
  // Refresh against the SAME effective base as the request (override or bundled).
  const refreshBase = getApiBaseOverride() ?? BUNDLED_API_URL;
  let data: any;
  try {
    ({ data } = await axios.post(`${refreshBase}/auth/refresh`, { refresh_token: rt }, { timeout: 15000 }));
  } catch (e: any) {
    const status = e?.response?.status;
    // The server explicitly rejected the refresh token → session over.
    if (status === 401 || status === 403) return null;
    // Network / timeout / 5xx → transient; keep the session and let a later request retry.
    throw new TransientRefreshError();
  }
  const attrs = data?.data?.attributes ?? {};
  const at = attrs.tokens?.access_token;
  if (!at) return null;
  await SecureStore.setItemAsync('access_token', at);
  setCachedAccessToken(at);
  // The server ROTATES the refresh token on every refresh (it revokes the one we just
  // sent). We MUST persist the new one it returns, or the next refresh would replay a
  // revoked token and force a logout.
  const newRt = attrs.tokens?.refresh_token;
  if (newRt) await SecureStore.setItemAsync('refresh_token', newRt);
  // Propagate any server-recomputed user flags carried on the refresh payload. The app
  // has no GET /me, so a flag raised AFTER login (e.g. the deferred own-number
  // verification wall, set by the daily sweep) would otherwise never reach an
  // already-signed-in session — it would only appear on a fresh login.
  if (attrs.user) {
    await useAuthStore.getState().setSession(attrs.user, resolveRole(attrs.user));
  }
  return at;
}

client.interceptors.response.use(
  (res) => {
    useOfflineStore.getState().noteNetworkOk();
    return res;
  },
  async (error) => {
    const original = error.config;
    // No answer at all (offline, timeout, DNS): a dropout, not a verdict.
    if (!error.response && original) {
      useOfflineStore.getState().noteNetworkFailure();
      // A queueable write that dropped is parked and reported as saved; a replay from the
      // outbox is left to fail so the queue keeps it.
      if (original.__queueRule && !original.__replay) {
        await parkRequest(original);
        return syntheticQueuedResponse(original);
      }
    }
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/refresh') &&
      // A sign-out or an impersonation stop that is refused is ALREADY what it asked for:
      // the token is dead. Running the "session over" recovery for it is what deadlocked
      // the exit from impersonation (founder 2026-10-02, «loops until it crashes»): the
      // recovery joins the in-flight leaveImpersonation(), which is awaiting this very
      // request, which is awaiting the recovery — a spinner for good, and on relaunch the
      // dead session repeats the cycle. These two just fail and let their caller carry on.
      !original.url?.includes('/auth/logout') &&
      !original.url?.includes('/impersonation/stop') &&
      // A wrong code is an answer, not an expired session: never «refresh» over it.
      !original.url?.includes('/auth/verify-otp') &&
      !original.url?.includes('/auth/reset-password')
    ) {
      original._retry = true;
      try {
        // Join the in-flight refresh if one is already running; otherwise start it.
        // Reset the shared slot once it settles so a later expiry refreshes again.
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const at = await refreshPromise;
        if (!at) throw new Error('no refresh');
        original.headers.Authorization = `Bearer ${at}`;
        return client(original);
      } catch (e) {
        // A transient refresh failure (network/timeout/5xx) must NOT sign the user
        // out — that was the spurious "token auto-expired" logout on flaky networks.
        // Keep the session; the next request will retry the refresh.
        if (e instanceof TransientRefreshError) {
          return Promise.reject(error);
        }
        // Genuine auth failure (no refresh token, or the server rejected it) — this
        // session is over. If it was an impersonation session, the super-admin's own
        // session is stashed and gets restored instead of a sign-out: an impersonation
        // token is unrefreshable and expires after 15 minutes BY DESIGN, so reaching here
        // is its ordinary end, not a reason to evict the admin too.
        await useAuthStore.getState().endImpersonationOrLogout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default client;
