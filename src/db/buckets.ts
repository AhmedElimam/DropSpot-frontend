import type { OfflineScan } from './offlineScans';

export interface ScanBucket {
  startTime: string; // ISO of first scan
  endTime: string; // ISO of last scan
  scans: OfflineScan[];
}

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Compute hour-based buckets from pending scans (main spec §3) — NOT tagged at
 * scan time. Group chronologically; whenever the gap between one scan and the
 * next exceeds 1 hour, start a new bucket. This naturally separates scans from
 * different, non-contiguous outages (e.g. a morning session vs an afternoon one).
 *
 * Assumes `scans` is already sorted by scanned_at ascending (getPendingScans is).
 */
export function computeBuckets(scans: OfflineScan[]): ScanBucket[] {
  const buckets: ScanBucket[] = [];
  let current: OfflineScan[] = [];
  let prevMs: number | null = null;

  for (const scan of scans) {
    const ms = new Date(scan.scanned_at).getTime();
    if (prevMs !== null && ms - prevMs > ONE_HOUR_MS && current.length > 0) {
      buckets.push(toBucket(current));
      current = [];
    }
    current.push(scan);
    prevMs = ms;
  }
  if (current.length > 0) buckets.push(toBucket(current));

  return buckets;
}

function toBucket(scans: OfflineScan[]): ScanBucket {
  return {
    startTime: scans[0].scanned_at,
    endTime: scans[scans.length - 1].scanned_at,
    scans,
  };
}
