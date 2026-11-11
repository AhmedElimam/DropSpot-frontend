import { AppState } from 'react-native';
import * as Location from 'expo-location';

/**
 * The phone's position, FOREGROUND ONLY (docs/PERFORMANCE.md rule 8, founder 2026-11-12: «this
 * app is known for its performance and light weight»). There is no watch and no background
 * task anywhere in the app: a screen that needs to follow the phone asks for ONE balanced
 * reading at most every 30 s, only while it is in front and the app is open. GPS is a heater;
 * a continuous watch (and a foreground service with the screen off) is what this replaced.
 *
 * Every caller shares one reading: two hooks on the same screen (a map and the screen around
 * it) cost one GPS fix per beat, not two.
 */
export const LOCATION_BEAT_MS = 30_000;
/** A reading this fresh is handed back instead of asking the GPS again (timer jitter allowed for). */
const FRESH_MS = LOCATION_BEAT_MS - 2_000;

export interface Fix { lat: number; lng: number; heading: number | null; speed: number | null; at: number }

let last: Fix | null = null;
let inFlight: Promise<Fix | null> | null = null;

/** The last place this phone was seen at — a new map opens there at once. */
export const lastKnownFix = (): Fix | null => last;

/** The direction of travel, only while really moving (a still phone's heading is noise). */
export function headingOf(pos: Location.LocationObject): number | null {
  const h = pos.coords.heading;
  const v = pos.coords.speed;
  return h != null && h >= 0 && v != null && v > 0.8 ? Math.round(h) : null;
}

const toFix = (pos: Location.LocationObject, at: number): Fix => ({
  lat: pos.coords.latitude, lng: pos.coords.longitude, heading: headingOf(pos), speed: pos.coords.speed ?? null, at,
});

/** When-in-use permission; asks once when `ask` and it was never answered. */
export async function locationPermitted(ask = true): Promise<boolean> {
  const cur = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (cur?.status === 'granted') return true;
  if (!ask) return false;
  const asked = await Location.requestForegroundPermissionsAsync().catch(() => null);
  return asked?.status === 'granted';
}

/**
 * The OS's own last known place — no GPS power — so a dot can show before the first reading.
 * Never counts as fresh: the next `sampleFix` still reads.
 */
export async function seedFix(): Promise<Fix | null> {
  if (last) return last;
  const pos = await Location.getLastKnownPositionAsync().catch(() => null);
  if (pos && !last) last = toFix(pos, 0);
  return last;
}

/**
 * One balanced reading — or the one taken less than a beat ago. Null with the app in the
 * background, without permission, or when the phone has no fix. `force` reads now regardless
 * (a tap: «أرسل موقعي», «وصلت»).
 */
export async function sampleFix(force = false): Promise<Fix | null> {
  if (AppState.currentState !== 'active') return null;
  if (!force && last && Date.now() - last.at < FRESH_MS) return last;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      if (!(await locationPermitted(false))) return null;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      last = toFix(pos, Date.now());
      return last;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** The background location tasks of builds before 2026-11-12 (driver stream, live share). */
const LEGACY_TASKS = ['drosspot-driver-location', 'drosspot-share-location'];

/**
 * A phone that updated while one of the old background streams was running would keep its GPS
 * and foreground service on until the OS dropped them: stop whatever is left, once per launch.
 */
export async function stopLegacyLocationTasks(): Promise<void> {
  for (const task of LEGACY_TASKS) {
    try {
      if (await Location.hasStartedLocationUpdatesAsync(task)) await Location.stopLocationUpdatesAsync(task);
    } catch {
      // Never registered, or location unavailable (simulator, revoked permission): nothing to stop.
    }
  }
}
