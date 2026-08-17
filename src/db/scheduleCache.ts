import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TeacherSession } from '@/api/teacher';
import { getTeacherTodaySessions } from '@/api/teacher';
import { getTeacherStudents } from '@/api/students';
import type { OfflineScan } from './offlineScans';

/**
 * Date- AND teacher-aware local cache of today's schedule + students-with-grades.
 * It powers two OFFLINE hints — never binding decisions:
 *   1. session-matching on the reconciliation screen (suggestSessionId), and
 *   2. the grade-mismatch bucket split (via buildGradeResolver).
 *
 * Keyed by (calendar date, teacher_id) — NOT date alone. An assistant who works
 * two teachers in one day keeps a SEPARATE entry per teacher, both retained: a
 * context switch that refreshes teacher B's slot must never overwrite teacher A's
 * still-buffered roster. The grade-check then resolves each scan against the entry
 * for THAT scan's own stamped teacher_id, never whoever is active on the device —
 * closing the cross-teacher mix-up one layer below the bucket guard.
 *
 * The staleness guard (invalidate on date rollover) applies PER ENTRY: yesterday's
 * entry for teacher A is dropped independently of a still-valid entry for B.
 */
const CACHE_KEY = 'schedule_cache_v2';

/** One student's grade, keyed for offline card→grade lookup. */
export interface CachedStudentGrade {
  student_id: number;
  student_code: string | null;
  grade_id: number | null;
}

/** Today's cached schedule for a single teacher context. */
export interface ScheduleCacheEntry {
  date: string; // YYYY-MM-DD, device-local, the day this data was fetched for
  teacher_id: number | null; // the teacher context this entry belongs to
  sessions: TeacherSession[];
  grades: CachedStudentGrade[];
}

type CacheMap = Record<string, ScheduleCacheEntry>;

/** Device-local calendar day as YYYY-MM-DD (deterministic, timezone-honest). */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Stable per-teacher key part (a solo teacher stamps their own id; null → 'solo'). */
function teacherKey(teacherId: number | null): string {
  return String(teacherId ?? 'solo');
}
function entryKey(date: string, teacherId: number | null): string {
  return `${date}|${teacherKey(teacherId)}`;
}

async function readMap(): Promise<CacheMap> {
  try {
    const json = await AsyncStorage.getItem(CACHE_KEY);
    if (!json) return {};
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as CacheMap) : {};
  } catch {
    return {}; // corrupt/unavailable — treat as no cache
  }
}

async function writeMap(map: CacheMap): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    // best-effort cache; a write failure just means no offline hint next time
  }
}

export async function clearScheduleCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // storage unavailable — nothing to do
  }
}

/**
 * Drop every entry not for the current calendar date (the staleness guard, applied
 * per entry so one teacher's rollover never touches another's). Persists only if
 * something changed. Returns the surviving (today-only) map.
 */
async function pruneStale(now: Date): Promise<CacheMap> {
  const map = await readMap();
  const today = localDateKey(now);
  let changed = false;
  for (const k of Object.keys(map)) {
    if (map[k].date !== today) {
      delete map[k];
      changed = true;
    }
  }
  if (changed) await writeMap(map);
  return map;
}

/** All of today's cached entries (one per teacher context), stale ones pruned. */
export async function getFreshScheduleEntries(now: Date = new Date()): Promise<ScheduleCacheEntry[]> {
  return Object.values(await pruneStale(now));
}

/** Today's cached entry for ONE teacher context, or null if stale/absent. */
export async function getFreshScheduleEntry(teacherId: number | null, now: Date = new Date()): Promise<ScheduleCacheEntry | null> {
  const map = await pruneStale(now);
  return map[entryKey(localDateKey(now), teacherId)] ?? null;
}

/**
 * Refresh TODAY's entry for a single teacher context from the server, when online.
 * The API returns data for whatever teacher context is currently active server-side,
 * so `teacherId` must be that same active context (from stampTeacherId) — it is the
 * key this entry is filed under, matching how scans are stamped. Best-effort:
 *   - other teachers' today entries are PRESERVED (only this key is written);
 *   - yesterday's entries are pruned in the same pass;
 *   - any failure leaves prior state untouched.
 * Returns the fresh entry, or null if it couldn't refresh.
 */
export async function refreshScheduleCache(teacherId: number | null, now: Date = new Date()): Promise<ScheduleCacheEntry | null> {
  try {
    const [sessions, roster] = await Promise.all([getTeacherTodaySessions(), getTeacherStudents()]);
    const entry: ScheduleCacheEntry = {
      date: localDateKey(now),
      teacher_id: teacherId,
      sessions,
      grades: roster.map((s) => ({
        student_id: Number(s.id),
        student_code: s.student_code,
        grade_id: s.grade_id,
      })),
    };
    const map = await pruneStale(now); // drop yesterday, keep OTHER teachers' today
    map[entryKey(entry.date, teacherId)] = entry; // add/refresh THIS teacher only
    await writeMap(map);
    return entry;
  } catch {
    return null; // offline or server error — keep whatever we had
  }
}

/**
 * On app open/resume (and on a teacher switch): enforce the per-entry staleness
 * guard, then refresh the active teacher's entry when online. `teacherId` is the
 * active context (stampTeacherId) — the same id its scans carry. Best-effort;
 * never throws. Offline across a day boundary → no fresh entry, so callers fall
 * back to manual reconciliation with no confident hint (never a stale guess).
 */
export async function syncScheduleCacheOnOpen(isOnline: boolean, teacherId: number | null, now: Date = new Date()): Promise<void> {
  await pruneStale(now);
  if (isOnline) {
    await refreshScheduleCache(teacherId, now);
  }
}

/**
 * Build an offline card_code → grade_id resolver across all cached teacher entries.
 * For each scan it selects the entry matching THAT scan's stamped teacher_id — never
 * the currently-active teacher — so teacher A's buffered scans always resolve against
 * A's roster even after the device switched to B. Returns null for any card it can't
 * resolve offline (no entry for the scan's teacher, opaque credential, unknown code),
 * so an unknown grade NEVER forces a bucket split (fail-safe, hint-only).
 */
export function buildGradeResolver(entries: ScheduleCacheEntry[]): (scan: OfflineScan) => number | null {
  if (!entries.length) return () => null;

  // Per-teacher lookup maps, built once.
  const perTeacher = new Map<string, { byId: Map<number, number | null>; byCode: Map<string, number | null> }>();
  for (const e of entries) {
    const byId = new Map<number, number | null>();
    const byCode = new Map<string, number | null>();
    for (const g of e.grades) {
      if (Number.isInteger(g.student_id)) byId.set(g.student_id, g.grade_id ?? null);
      if (g.student_code) byCode.set(g.student_code, g.grade_id ?? null);
    }
    perTeacher.set(teacherKey(e.teacher_id), { byId, byCode });
  }

  return (scan: OfflineScan): number | null => {
    const maps = perTeacher.get(teacherKey(scan.teacher_id ?? null));
    if (!maps) return null; // no cache for THIS scan's teacher → unknown → no split
    const code = scan.card_code;
    if (code.includes(':')) {
      const id = Number(code.split(':')[0]);
      if (Number.isInteger(id) && maps.byId.has(id)) return maps.byId.get(id) ?? null;
      return null; // signed form we can't verify to a known id → unknown
    }
    return maps.byCode.get(code) ?? null; // legacy student_code, or opaque → null
  };
}
