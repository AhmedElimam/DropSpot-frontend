import * as SecureStore from 'expo-secure-store';
import { uuid } from '@/utils/uuid';

/**
 * A random id made once per install and kept in the keystore (survives sign-out, not a
 * reinstall). Sent as X-Install-Id so the server can tell when two accounts sign in
 * from the same phone (fraud signals). It names no device and carries nothing personal;
 * the server stores only a keyed hash of it.
 */
const KEY = 'install_id';
let cached: string | null | undefined;

export async function installId(): Promise<string | null> {
  if (cached !== undefined) return cached;
  try {
    let id = await SecureStore.getItemAsync(KEY);
    if (!id) {
      id = uuid();
      await SecureStore.setItemAsync(KEY, id);
    }
    cached = id;
  } catch {
    // A keystore hiccup must never block a request; try again next time.
    return null;
  }
  return cached;
}
