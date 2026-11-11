import AsyncStorage from '@react-native-async-storage/async-storage';
import { sharePrintLocation, stopPrintLocation } from '@/api/print';
import { locationPermitted, sampleFix, seedFix } from '@/utils/foregroundLocation';

/**
 * Where the teacher (or an assistant) is, for the print shop's driver — two ways:
 *  - «موقعي الحالي»: one fixed pin, one call;
 *  - «موقعي المباشر»: for 15 min / 1 h / 8 h. FOREGROUND ONLY (founder 2026-11-12, performance
 *    rule 8): the order page sends one balanced reading every 30 s while it is in front and
 *    the app is open (useOrderShare), and stops when the time is up. Nothing runs with the
 *    screen off or the app closed — the driver keeps the last point sent until she is back.
 *
 * This file only remembers which job is being shared and until when; the beat itself lives
 * with the screen. The server refuses a point after the end too, so a stray one changes nothing.
 */
const KEY = 'print.live_share';

export interface LiveShare { jobId: number; until: number }
export type ShareResult = 'ok' | 'denied' | 'no_fix' | 'failed';

/** The share this phone started, while its time still runs. */
export async function readLiveShare(): Promise<LiveShare | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as LiveShare) : null;
    return v && v.until > Date.now() ? v : null;
  } catch {
    return null;
  }
}

export async function clearLiveShare(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* nothing kept */ }
}

/** The phone's position for a tap: a reading now, else the OS's last known place. */
async function positionNow(): Promise<{ lat: number; lng: number } | null> {
  return (await sampleFix(true)) ?? (await seedFix());
}

/** «أرسل موقعي الحالي»: one fixed pin for the trip. Ends a running live share first. */
export async function sendStaticLocation(jobId: number): Promise<ShareResult> {
  if (!(await locationPermitted())) return 'denied';
  const p = await positionNow();
  if (!p) return 'no_fix';
  await clearLiveShare();
  try {
    await sharePrintLocation(jobId, p.lat, p.lng, 'static');
    return 'ok';
  } catch {
    return 'failed';
  }
}

/** «موقعي المباشر» for `minutes` (15 / 60 / 480): the first point now, the rest from the open order page. */
export async function startLiveShare(jobId: number, minutes: number): Promise<ShareResult> {
  if (!(await locationPermitted())) return 'denied';
  const p = await positionNow();
  if (!p) return 'no_fix';
  try {
    const r = await sharePrintLocation(jobId, p.lat, p.lng, 'live', minutes);
    if (!r.sharing) return 'failed';
  } catch {
    return 'failed';
  }
  const until = Date.now() + minutes * 60_000;
  try { await AsyncStorage.setItem(KEY, JSON.stringify({ jobId, until } satisfies LiveShare)); } catch { /* the server still ends it on time */ }
  return 'ok';
}

/**
 * One beat of a running live share: the reading of this half-minute goes to the driver.
 * False when the share is over (time up here or on the server, trip closed) — it is cleared.
 */
export async function sendLiveBeat(share: LiveShare): Promise<boolean> {
  if (share.until <= Date.now()) { await clearLiveShare(); return false; }
  const p = await sampleFix();
  if (!p) return true; // no reading this time (no fix, app not in front): the next beat tries again
  try {
    const r = await sharePrintLocation(share.jobId, p.lat, p.lng, 'live');
    if (!r.sharing) { await clearLiveShare(); return false; }
  } catch {
    // offline: the next beat tries again
  }
  return true;
}

/** Stop sharing — the driver sees nothing more. */
export async function stopLiveShare(jobId: number): Promise<void> {
  await clearLiveShare();
  try { await stopPrintLocation(jobId); } catch { /* the server ends it on time anyway */ }
}
