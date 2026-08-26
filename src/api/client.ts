import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore, resolveRole } from '@/stores/authStore';
import { ensureApiBaseHydrated, getApiBaseOverride } from '@/api/apiBase';

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
function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
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
  // The API lives on a shared host that can be slow to warm on a cold cellular
  // connection (common on Android/Samsung after the process is killed in the
  // background). A tight 15s ceiling turned those warm-ups into hard failures →
  // the reload screen on first load; 30s lets the first request through.
  timeout: 30000,
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
  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync('access_token');
  } catch {
    token = null;
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // App version for server-side observability (never a hard gate — the blocking
  // update screen is enforced client-side against the shipped binary version).
  const appVersion = Constants.expoConfig?.version;
  if (appVersion) config.headers['X-App-Version'] = appVersion;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/login')
    ) {
      original._retry = true;
      try {
        const rt = await SecureStore.getItemAsync('refresh_token');
        if (!rt) throw new Error('no refresh');
        // Refresh against the SAME effective base as the request (override or bundled).
        const refreshBase = getApiBaseOverride() ?? BUNDLED_API_URL;
        const { data } = await axios.post(`${refreshBase}/auth/refresh`, { refresh_token: rt });
        const attrs = data?.data?.attributes ?? {};
        const at = attrs.tokens.access_token;
        await SecureStore.setItemAsync('access_token', at);
        // The server ROTATES the refresh token on every refresh (it revokes the one
        // we just sent). We MUST persist the new one it returns, or the next refresh
        // would replay a revoked token and force a logout. Missing this line was
        // silently signing everyone out ~one access-token lifetime after login.
        const newRt = attrs.tokens.refresh_token;
        if (newRt) await SecureStore.setItemAsync('refresh_token', newRt);
        // Propagate any server-recomputed user flags carried on the refresh payload.
        // The app has no GET /me, so a flag raised AFTER login (e.g. the deferred
        // own-number verification wall, set by the daily sweep) would otherwise never
        // reach an already-signed-in session — it would only appear on a fresh login.
        // Refreshing the stored user here lets it engage on the next token refresh.
        if (attrs.user) {
          await useAuthStore.getState().setSession(attrs.user, resolveRole(attrs.user));
        }
        original.headers.Authorization = `Bearer ${at}`;
        return client(original);
      } catch (e) {
        // Refresh failed — session is over; fall through to logout.
        await useAuthStore.getState().logout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default client;
