import type { OfflineScan } from './offlineScans';

export interface ScanBucket {
  startTime: string; // ISO of first scan
  endTime: string; // ISO of last scan
  teacherId: number | null; // the teacher context these scans were stamped with
  scans: OfflineScan[];
}

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Compute buckets from pending scans (main spec §3). Group chronologically;
 * start a new bucket whenever the gap exceeds 1 hour, OR whenever the scan-time
 * teacher context changes. The latter is a §4 safety boundary: scans stamped for
 * teacher A and teacher B never share a bucket, so a bucket always syncs to a
 * single teacher's session and can carry one authoritative expected_teacher_id.
 *
 * Assumes `scans` is already sorted by scanned_at ascending (getPendingScans is).
 */
export function computeBuckets(scans: OfflineScan[]): ScanBucket[] {
  const buckets: ScanBucket[] = [];
  let current: OfflineScan[] = [];
  let prevMs: number | null = null;
  let prevTeacher: number | null | undefined = undefined;

  for (const scan of scans) {
    const ms = new Date(scan.scanned_at).getTime();
    const teacher = scan.teacher_id ?? null;
    const gapBreak = prevMs !== null && ms - prevMs > ONE_HOUR_MS;
    const teacherBreak = prevTeacher !== undefined && teacher !== prevTeacher;
    if ((gapBreak || teacherBreak) && current.length > 0) {
      buckets.push(toBucket(current));
      current = [];
    }
    current.push(scan);
    prevMs = ms;
    prevTeacher = teacher;
  }
  if (current.length > 0) buckets.push(toBucket(current));

  return buckets;
}

function toBucket(scans: OfflineScan[]): ScanBucket {
  return {
    startTime: scans[0].scanned_at,
    endTime: scans[scans.length - 1].scanned_at,
    teacherId: scans[0].teacher_id ?? null,
    scans,
  };
}
