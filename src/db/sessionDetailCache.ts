import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionDetail } from '@/api/teacherSessions';

/**
 * Last-known roster per session, so the attendance sheet opens with no signal and the
 * teacher can mark present/absent (queued by offlineMarks). Written whenever a session's
 * detail is fetched, and pre-fetched for today's sessions when the schedule cache
 * refreshes. Entries older than two days are dropped. Hint data only — the server's
 * answer always replaces it the moment there is a connection.
 */
const KEY = 'session_detail_cache_v1';
const TTL_MS = 2 * 24 * 60 * 60 * 1000;

interface Entry { at: number; detail: SessionDetail }
type Map = Record<string, Entry>;

async function readMap(): Promise<Map> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const map: Map = raw ? JSON.parse(raw) : {};
    const cutoff = Date.now() - TTL_MS;
    let changed = false;
    for (const k of Object.keys(map)) if (map[k].at < cutoff) { delete map[k]; changed = true; }
    if (changed) await AsyncStorage.setItem(KEY, JSON.stringify(map));
    return map;
  } catch {
    return {};
  }
}

export async function cacheSessionDetail(id: string | number, detail: SessionDetail): Promise<void> {
  try {
    const map = await readMap();
    map[String(id)] = { at: Date.now(), detail };
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // best-effort
  }
}

export async function readCachedSessionDetail(id: string | number): Promise<{ detail: SessionDetail; at: number } | null> {
  const e = (await readMap())[String(id)];
  return e ? { detail: e.detail, at: e.at } : null;
}

/** Age of the cached copy in ms, or null when there is none. */
export async function cachedSessionAge(id: string | number): Promise<number | null> {
  const e = (await readMap())[String(id)];
  return e ? Date.now() - e.at : null;
}
