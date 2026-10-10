import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import type { SessionDetail } from '@/api/teacherSessions';

/**
 * Last-known roster per session, so the attendance sheet opens with no signal and the
 * teacher can mark present/absent (queued by offlineMarks). Written whenever a session's
 * detail is fetched, and pre-fetched for this week's sessions by the warm-up. Entries older
 * than two days are dropped once per app open. Hint data only — the server's answer always
 * replaces it the moment there is a connection.
 *
 * One SQLite row per session (founder 2026-10-10: «no performance … on any end»): saving a
 * sheet writes that sheet alone, not the whole week re-serialised, and nothing is capped by
 * Android's 6 MB AsyncStorage. A small index (id → saved-at) answers «how old is this one»
 * without reading the sheet.
 */
const storage = new SQLiteStorage('session-detail');
const PREFIX = 'sd:';
const INDEX = 'index';
const TTL_MS = 2 * 24 * 60 * 60 * 1000;
/** The pre-SQLite blob (one JSON of every sheet): cleared on the first open after the move. */
const LEGACY_KEY = 'session_detail_cache_v1';

interface Entry { at: number; detail: SessionDetail }
type Index = Record<string, number>;

function parseIndex(raw: string | null): Index {
  try {
    return raw ? (JSON.parse(raw) as Index) : {};
  } catch {
    return {};
  }
}

async function readIndex(): Promise<Index> {
  try {
    return parseIndex(await storage.getItemAsync(INDEX));
  } catch {
    return {};
  }
}

async function updateIndex(patch: (index: Index) => void): Promise<void> {
  await storage.setItemAsync(INDEX, (prev) => {
    const index = parseIndex(prev);
    patch(index);
    return JSON.stringify(index);
  });
}

export async function cacheSessionDetail(id: string | number, detail: SessionDetail, now = Date.now()): Promise<void> {
  try {
    const entry: Entry = { at: now, detail };
    await storage.setItemAsync(PREFIX + String(id), JSON.stringify(entry));
    await updateIndex((index) => { index[String(id)] = now; });
  } catch {
    // best-effort
  }
}

export async function readCachedSessionDetail(id: string | number, now = Date.now()): Promise<{ detail: SessionDetail; at: number } | null> {
  try {
    const raw = await storage.getItemAsync(PREFIX + String(id));
    if (!raw) return null;
    const e = JSON.parse(raw) as Entry;
    if (now - e.at > TTL_MS) {
      void removeCachedSessionDetail(id);
      return null;
    }
    return { detail: e.detail, at: e.at };
  } catch {
    return null;
  }
}

/** Age of the cached copy in ms, or null when there is none — from the index, no sheet read. */
export async function cachedSessionAge(id: string | number, now = Date.now()): Promise<number | null> {
  const at = (await readIndex())[String(id)];
  if (at === undefined) return null;
  const age = now - at;
  return age > TTL_MS ? null : age;
}

async function removeCachedSessionDetail(id: string | number): Promise<void> {
  try {
    await storage.removeItemAsync(PREFIX + String(id));
    await updateIndex((index) => { delete index[String(id)]; });
  } catch {
    // best-effort
  }
}

/** Once per app open: drop sheets older than two days, and the pre-SQLite blob if still there. */
export async function pruneSessionDetailCache(now = Date.now()): Promise<void> {
  try {
    const index = await readIndex();
    for (const [id, at] of Object.entries(index)) {
      if (now - at > TTL_MS) await removeCachedSessionDetail(id);
    }
  } catch {
    // best-effort
  }
  try {
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {
    // best-effort
  }
}
