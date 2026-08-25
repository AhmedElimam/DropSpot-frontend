import type { OfflineScan } from './offlineScans';
import { configRule } from '@/stores/appConfigStore';

export interface ScanBucket {
  startTime: string; // ISO of first scan
  endTime: string; // ISO of last scan
  teacherId: number | null; // the teacher context these scans were stamped with
  scans: OfflineScan[];
}

// The bucket-split gap is config-driven (offline_bucket_gap_min); the bundled
// default (60) reproduces the original ONE_HOUR_MS exactly.

/**
 * Resolve a scan's academic grade offline (Part 1). Returns null when the grade
 * is unknown (card not resolvable offline, or no schedule cache) — an unknown
 * grade must NEVER force or block a split, keeping the guard a hint only.
 */
export type GradeResolver = (scan: OfflineScan) => number | null;

/**
 * Compute buckets from pending scans (main spec §3). Group chronologically;
 * start a new bucket whenever:
 *   - the gap exceeds 1 hour, OR
 *   - the scan-time teacher context changes (§4 safety boundary: scans stamped
 *     for teacher A and teacher B never share a bucket, so a bucket always syncs
 *     to a single teacher and can carry one authoritative expected_teacher_id), OR
 *   - the student's GRADE changes (Part 1): two different-grade sessions running
 *     back-to-back with a tiny gap are clearly two sessions, so a grade change is
 *     as strong a "different session" signal as a teacher change. Only splits when
 *     BOTH the bucket's established grade and the next scan's grade are KNOWN and
 *     differ — an unknown grade is ignored (never forces or blocks a split).
 *
 * `gradeOf` is optional; without it (or when it returns null) behaviour is
 * exactly as before. Assumes `scans` is sorted by scanned_at ascending.
 */
export function computeBuckets(scans: OfflineScan[], gradeOf?: GradeResolver): ScanBucket[] {
  const gapMs = configRule('offline_bucket_gap_min') * 60 * 1000;
  const buckets: ScanBucket[] = [];
  let current: OfflineScan[] = [];
  let prevMs: number | null = null;
  let prevTeacher: number | null | undefined = undefined;
  let bucketGrade: number | null = null; // the current bucket's established grade

  for (const scan of scans) {
    const ms = new Date(scan.scanned_at).getTime();
    const teacher = scan.teacher_id ?? null;
    const grade = gradeOf ? gradeOf(scan) : null;

    const gapBreak = prevMs !== null && ms - prevMs > gapMs;
    const teacherBreak = prevTeacher !== undefined && teacher !== prevTeacher;
    const gradeBreak = bucketGrade !== null && grade !== null && grade !== bucketGrade;

    if ((gapBreak || teacherBreak || gradeBreak) && current.length > 0) {
      buckets.push(toBucket(current));
      current = [];
      bucketGrade = null;
    }
    current.push(scan);
    prevMs = ms;
    prevTeacher = teacher;
    // The bucket's grade is the first KNOWN grade among its scans; an unknown
    // grade never poisons it, so a later known grade can still trigger a split.
    if (bucketGrade === null && grade !== null) bucketGrade = grade;
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
