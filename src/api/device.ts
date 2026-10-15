import { Platform } from 'react-native';
import Constants from 'expo-constants';
import client from './client';
import { getDeviceId } from '@/utils/deviceId';
import { countPendingScans, oldestPendingScanAt } from '@/db/offlineScans';

/**
 * Device heartbeat — tells the server how many offline scans this phone is holding and
 * how old the oldest is (ops decisions D). Counts and timestamps only, never contents:
 * sync remains the only path that moves attendance. Strictly additive — every failure is
 * swallowed; this must never affect scanning, syncing or launch.
 */
let lastSentAt = 0;
const MIN_GAP_MS = 60_000;

export async function sendDeviceHeartbeat(activeTeacherId?: number | null, force = false): Promise<void> {
  try {
    if (!force && Date.now() - lastSentAt < MIN_GAP_MS) return;
    lastSentAt = Date.now();
    const [device_id, pending_scan_count, oldest] = await Promise.all([
      getDeviceId(),
      countPendingScans(),
      oldestPendingScanAt(),
    ]);
    await client.post('/device/heartbeat', {
      device_id,
      pending_scan_count,
      oldest_pending_at: pending_scan_count > 0 ? oldest : null,
      active_teacher_id: activeTeacherId ?? null,
      app_version: Constants.expoConfig?.version ?? null,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    });
  } catch {
    // Silent by design — a health signal must never become a failure of its own.
  }
}
