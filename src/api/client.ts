import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/stores/authStore';

/**
 * Resolve the API base URL.
 *
 * `localhost` / `0.0.0.0` point at the DEVICE, not the dev machine, so they never
 * work from a phone or Android emulator. In development we derive the dev
 * machine's address from the Metro bundler host the device is already talking to
 * (Constants.expoConfig.hostUri, e.g. "192.168.1.50:8081") and target port 8000
 * there. An explicit EXPO_PUBLIC_API_URL always wins (use it for real builds).
 *
 * NOTE: the Laravel server must be reachable at that host — run it with
 * `php artisan serve --host 0.0.0.0 --port 8000` and keep the device on the same
 * Wi-Fi as the Mac.
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

  // Simulator / web fallback (shares the Mac's network).
  return 'http://localhost:8000/api/v1';
}

const API_URL = resolveApiUrl();

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[api] baseURL =', API_URL);
}

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  timeout: 15000,
});

client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: rt });
        const at = data.data.attributes.tokens.access_token;
        await SecureStore.setItemAsync('access_token', at);
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
