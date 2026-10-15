import * as SecureStore from 'expo-secure-store';

/**
 * A stable per-install id for the device heartbeat. Generated once, kept in SecureStore
 * (already a dependency — no new native module, ships over OTA). Reinstall = new id,
 * which is exactly right: the old id's buffer row is what the ops desk should see go
 * silent while still holding scans.
 */
const KEY = 'drosspot_device_id';
let cached: string | null = null;

function randomId(): string {
  const bytes = new Uint8Array(16);
  // crypto.getRandomValues exists in Hermes/RN 0.7x+; fall back to Math.random if not.
  const g = (globalThis as any).crypto?.getRandomValues;
  if (g) g.call((globalThis as any).crypto, bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing) return (cached = existing);
    const fresh = randomId();
    await SecureStore.setItemAsync(KEY, fresh);
    return (cached = fresh);
  } catch {
    // SecureStore unavailable (rare): a per-session id still lets the server see the buffer.
    return (cached = cached ?? randomId());
  }
}
