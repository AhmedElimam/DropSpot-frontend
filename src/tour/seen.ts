import AsyncStorage from '@react-native-async-storage/async-storage';

// Kept apart from the store: the store is imported by the tab bar, which the tests render
// without native modules.
// ── seen flags ──
const key = (role: string, userId: number | string) => `tour:seen:v1:${role}:${userId}`;

export async function tourSeen(role: string, userId: number | string): Promise<boolean> {
  try { return (await AsyncStorage.getItem(key(role, userId))) === '1'; } catch { return true; }
}

export async function markTourSeen(role: string, userId: number | string): Promise<void> {
  try { await AsyncStorage.setItem(key(role, userId), '1'); } catch { /* a phone that cannot store it will see the tour again; nothing worse */ }
}
