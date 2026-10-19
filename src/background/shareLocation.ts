import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sharePrintLocation, stopPrintLocation } from '@/api/print';

/**
 * Live location for the driver, like WhatsApp's (founder 2026-10-14: «live location has its own
 * icon, works with the phone in the background, like WhatsApp live location, and the teacher
 * or assistant selects a timer»). Started for one print job with a length — 15 min, 1 h, 8 h —
 * it keeps sending where the phone is (screen off, any app) until that time, then stops by
 * itself. The server refuses a point after the end too, so a stray one changes nothing.
 *
 * iOS: when-in-use permission is enough (the blue pill shows); Android: a foreground service
 * with its own notification. Defined at the bundle's top (index.js).
 *
 * A fixed pin («أرسل موقعي الحالي») is just one call — no task.
 */
export const SHARE_LOCATION_TASK = 'drosspot-share-location';
const KEY = 'print.live_share';
const MIN_GAP = 15_000;
let lastSent = 0;

export interface LiveShare { jobId: number; until: number }

export async function readLiveShare(): Promise<LiveShare | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as LiveShare) : null;
    return v && v.until > Date.now() ? v : null;
  } catch {
    return null;
  }
}

async function clearLiveShare(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* nothing kept */ }
  try {
    if (await Location.hasStartedLocationUpdatesAsync(SHARE_LOCATION_TASK)) await Location.stopLocationUpdatesAsync(SHARE_LOCATION_TASK);
  } catch { /* not running */ }
}

TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(SHARE_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const share = await readLiveShare();
  if (!share) { await clearLiveShare(); return; }
  if (Date.now() - lastSent < MIN_GAP) return;
  lastSent = Date.now();
  const pos = data.locations[data.locations.length - 1];
  try {
    const r = await sharePrintLocation(share.jobId, pos.coords.latitude, pos.coords.longitude, 'live');
    if (!r.sharing) await clearLiveShare(); // over on the server (time up, trip closed)
  } catch {
    lastSent = 0; // offline: the next point tries again
  }
});

/** The phone's position now — the last known fix at once, else one quick reading. */
export async function quickPosition(): Promise<{ lat: number; lng: number } | null> {
  const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 }).catch(() => null);
  if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
  const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
  return now ? { lat: now.coords.latitude, lng: now.coords.longitude } : null;
}

async function permitted(): Promise<boolean> {
  const cur = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (cur?.status === 'granted') return true;
  const asked = await Location.requestForegroundPermissionsAsync().catch(() => null);
  return asked?.status === 'granted';
}

export type ShareResult = 'ok' | 'denied' | 'no_fix' | 'failed';

/** «أرسل موقعي الحالي»: one fixed pin for the trip. Ends a running live share first. */
export async function sendStaticLocation(jobId: number): Promise<ShareResult> {
  if (!(await permitted())) return 'denied';
  const p = await quickPosition();
  if (!p) return 'no_fix';
  await clearLiveShare();
  try {
    await sharePrintLocation(jobId, p.lat, p.lng, 'static');
    return 'ok';
  } catch {
    return 'failed';
  }
}

/** «موقعي المباشر» for `minutes` (15 / 60 / 480): the first point now, the rest from the background. */
export async function startLiveShare(jobId: number, minutes: number): Promise<ShareResult> {
  if (!(await permitted())) return 'denied';
  const p = await quickPosition();
  if (!p) return 'no_fix';
  try {
    const r = await sharePrintLocation(jobId, p.lat, p.lng, 'live', minutes);
    if (!r.sharing) return 'failed';
  } catch {
    return 'failed';
  }
  const until = Date.now() + minutes * 60_000;
  try { await AsyncStorage.setItem(KEY, JSON.stringify({ jobId, until } satisfies LiveShare)); } catch { /* the server still ends it on time */ }
  try {
    if (!(await Location.hasStartedLocationUpdatesAsync(SHARE_LOCATION_TASK))) {
      await Location.startLocationUpdatesAsync(SHARE_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 15_000,
        distanceInterval: 10,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'موقعك المباشر مع السائق',
          notificationBody: 'DrosSpot بيشارك موقعك مع سائق المطبعة لحد ما الوقت يخلص',
          notificationColor: '#C9A227',
          killServiceOnDestroy: false,
        },
      });
    }
  } catch { /* foreground-only: the screen still sends while open */ }
  return 'ok';
}

/** Stop sharing — the driver sees nothing more. */
export async function stopLiveShare(jobId: number): Promise<void> {
  await clearLiveShare();
  try { await stopPrintLocation(jobId); } catch { /* the server ends it on time anyway */ }
}

/**
 * A share whose time is up — or any share at all while the print market is off — must not
 * keep the GPS and its foreground service running. The task only ended itself when a NEW
 * location arrived, so a phone that stood still, or an app killed mid-share, kept them on
 * (2026-10-19 staging audit). Called from the teacher layout at launch and on every return.
 */
export async function stopStaleLiveShare(printMarketOn: boolean): Promise<void> {
  try {
    if (!(await Location.hasStartedLocationUpdatesAsync(SHARE_LOCATION_TASK))) return;
    if (printMarketOn && (await readLiveShare())) return;
    await clearLiveShare();
  } catch {
    // Location unavailable (simulator, revoked permission): nothing is running to stop.
  }
}
