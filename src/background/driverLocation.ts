import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { driverHeartbeat } from '@/api/driver';

/**
 * The rider's position, with the phone in his pocket (founder 2026-10-14: «the live
 * locations doesn't work … like Talabat»). While a driver is signed in and «متصل», the OS
 * hands the app his position as he moves — screen off, another app open — and each one goes
 * to the server as a heartbeat, which also feeds the trip in hand (trail, ETA, arriving by
 * itself near the pin). The teacher and the shop watch the dot move without the driver
 * keeping our screen open.
 *
 * iOS: «while using» permission is enough — updates started in the foreground carry on in
 * the background with the blue location pill showing. Android: a foreground service with
 * its own notification, no background-location permission asked.
 *
 * Defined at the bundle's top (index.js) so the OS can deliver to it whenever it wakes us.
 */
export const DRIVER_LOCATION_TASK = 'drosspot-driver-location';

/** One send at most this often (ms); the OS may deliver points faster in a batch. */
const MIN_GAP = 12_000;
let lastSent = 0;

TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(DRIVER_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const pos = data.locations[data.locations.length - 1];
  if (Date.now() - lastSent < MIN_GAP) return;
  lastSent = Date.now();
  try {
    await driverHeartbeat(pos.coords.latitude, pos.coords.longitude, pos.coords.speed ?? null);
  } catch {
    // Offline or signed out — the next point tries again; a cut driver stops the task on open.
    lastSent = 0;
  }
});

/** Start (or keep) the background stream. False when the phone refused location. */
export async function startDriverTracking(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const asked = await Location.requestForegroundPermissionsAsync();
      if (asked.status !== 'granted') return false;
    }
    if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK).catch(() => false)) return true;
    await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10_000,
      distanceInterval: 20,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'DrosSpot — التوصيل',
        notificationBody: 'موقعك يظهر للمطبعة والمعلّم أثناء التوصيل',
        notificationColor: '#C9A227',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopDriverTracking(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
    }
  } catch { /* not running */ }
}
