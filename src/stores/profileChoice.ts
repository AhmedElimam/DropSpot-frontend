import AsyncStorage from '@react-native-async-storage/async-storage';
import { rememberedProfileKey } from '@/utils/sharedProfiles';

/**
 * The last profile chosen on a shared phone, per phone holder: the picker pre-highlights it
 * at the next sign-in. A convenience only — a missing or unreadable value just highlights the
 * profile the login signed in as.
 */
export async function readRememberedProfile(holderId: number | null): Promise<number | null> {
  if (holderId == null) return null;
  try {
    const raw = await AsyncStorage.getItem(rememberedProfileKey(holderId));
    const n = raw == null ? NaN : Number(raw);

    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function rememberProfile(holderId: number | null, userId: number): Promise<void> {
  if (holderId == null) return;
  try {
    await AsyncStorage.setItem(rememberedProfileKey(holderId), String(userId));
  } catch {
    // best-effort
  }
}
