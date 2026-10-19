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
let lastCheckedAt = 0;
let lastSentCount = -1;
const MIN_GAP_MS = 60_000;
/**
 * A healthy phone (nothing waiting, nothing changed) reports at most this often — it posted
 * every minute of foreground use before (2026-10-19 staging audit). Scans waiting, or a
 * count that moved, still report at once: that is what ops watches.
 */
export const HEARTBEAT_IDLE_MS = 15 * 60_000;

export async function sendDeviceHeartbeat(activeTeacherId?: number | null, force = false): Promise<void> {
  try {
    const now = Date.now();
    if (!force && now - lastCheckedAt < MIN_GAP_MS) return;
    lastCheckedAt = now;
    const pending = await countPendingScans();
    const news = pending > 0 || pending !== lastSentCount || now - lastSentAt >= HEARTBEAT_IDLE_MS;
    if (!force && !news) return;
    lastSentAt = now;
    lastSentCount = pending;
    const [device_id, oldest] = await Promise.all([getDeviceId(), pending > 0 ? oldestPendingScanAt() : Promise.resolve(null)]);
    const pending_scan_count = pending;
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
