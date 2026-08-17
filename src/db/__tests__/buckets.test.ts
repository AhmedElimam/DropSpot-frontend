import { computeBuckets, type GradeResolver } from '@/db/buckets';
import type { OfflineScan } from '@/db/offlineScans';

function scan(id: number, scanned_at: string, teacher_id: number | null = null): OfflineScan {
  return { id, card_code: `CARD-${id}`, scanned_at, teacher_id, last_error: null, status: 'pending' };
}

/** Resolver from an explicit id→grade map; ids not in the map are "unknown" (null). */
function gradeMap(map: Record<number, number | null>): GradeResolver {
  return (s: OfflineScan) => (s.id in map ? map[s.id] : null);
}

describe('computeBuckets', () => {
  it('keeps scans within a 1h window in a single bucket', () => {
    const buckets = computeBuckets([
      scan(1, '2026-08-16T09:00:00.000Z'),
      scan(2, '2026-08-16T09:20:00.000Z'),
      scan(3, '2026-08-16T09:55:00.000Z'),
    ]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].scans.map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it('splits into a new bucket when the gap exceeds 1h', () => {
    const buckets = computeBuckets([
      scan(1, '2026-08-16T09:00:00.000Z'),
      scan(2, '2026-08-16T11:30:00.000Z'), // > 1h after #1
    ]);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].scans.map((s) => s.id)).toEqual([1]);
    expect(buckets[1].scans.map((s) => s.id)).toEqual([2]);
  });

  // §5: a device offline for days accumulates scans across several occurrences of
  // the same recurring class — each day's scans must land in its own bucket so it
  // can be reconciled against its own session.
  it('separates scans captured on different days into distinct buckets', () => {
    const buckets = computeBuckets([
      scan(1, '2026-08-14T09:05:00.000Z'),
      scan(2, '2026-08-14T09:25:00.000Z'),
      scan(3, '2026-08-16T09:05:00.000Z'), // two days later
      scan(4, '2026-08-16T09:30:00.000Z'),
    ]);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].scans.map((s) => s.id)).toEqual([1, 2]);
    expect(buckets[1].scans.map((s) => s.id)).toEqual([3, 4]);
  });

  // §4 boundary: scans stamped for different teachers never share a bucket, even
  // seconds apart, so each bucket carries one authoritative expected_teacher_id.
  it('splits on a teacher-context change even within the 1h window', () => {
    const buckets = computeBuckets([
      scan(1, '2026-08-16T09:00:00.000Z', 10),
      scan(2, '2026-08-16T09:05:00.000Z', 10),
      scan(3, '2026-08-16T09:10:00.000Z', 20), // teacher switch
    ]);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].teacherId).toBe(10);
    expect(buckets[1].teacherId).toBe(20);
    expect(buckets[1].scans.map((s) => s.id)).toEqual([3]);
  });
});

describe('computeBuckets — grade-mismatch split (Part 1)', () => {
  it('splits two back-to-back different-grade sessions with a tiny gap', () => {
    // Grade 1 class ends 4:58pm, Grade 2 starts 5:02pm — a 4-min gap and the same
    // teacher, so time/teacher rules alone would wrongly MERGE them.
    const buckets = computeBuckets(
      [
        scan(1, '2026-08-16T16:56:00.000Z', 10),
        scan(2, '2026-08-16T16:58:00.000Z', 10),
        scan(3, '2026-08-16T17:02:00.000Z', 10),
        scan(4, '2026-08-16T17:04:00.000Z', 10),
      ],
      gradeMap({ 1: 1, 2: 1, 3: 2, 4: 2 }),
    );
    expect(buckets).toHaveLength(2);
    expect(buckets[0].scans.map((s) => s.id)).toEqual([1, 2]);
    expect(buckets[1].scans.map((s) => s.id)).toEqual([3, 4]);
  });

  it('keeps same-grade back-to-back scans in one bucket', () => {
    const buckets = computeBuckets(
      [
        scan(1, '2026-08-16T16:56:00.000Z', 10),
        scan(2, '2026-08-16T17:02:00.000Z', 10),
      ],
      gradeMap({ 1: 3, 2: 3 }),
    );
    expect(buckets).toHaveLength(1);
  });

  it('never splits on an unknown grade (fail-safe, hint-only)', () => {
    // Middle scan's grade is unknown (e.g. an opaque card): it must neither force
    // a split nor poison the bucket's established grade.
    const buckets = computeBuckets(
      [
        scan(1, '2026-08-16T16:56:00.000Z', 10),
        scan(2, '2026-08-16T16:58:00.000Z', 10),
        scan(3, '2026-08-16T17:00:00.000Z', 10),
      ],
      gradeMap({ 1: 1, 3: 1 }), // scan 2 unknown
    );
    expect(buckets).toHaveLength(1);
    expect(buckets[0].scans.map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it('establishes the bucket grade from the first KNOWN grade, then splits on a differing one', () => {
    // First scan unknown → bucket grade set by scan 2 (grade 1); scan 3 (grade 2) splits.
    const buckets = computeBuckets(
      [
        scan(1, '2026-08-16T09:00:00.000Z', 10),
        scan(2, '2026-08-16T09:02:00.000Z', 10),
        scan(3, '2026-08-16T09:04:00.000Z', 10),
      ],
      gradeMap({ 2: 1, 3: 2 }), // scan 1 unknown
    );
    expect(buckets).toHaveLength(2);
    expect(buckets[0].scans.map((s) => s.id)).toEqual([1, 2]);
    expect(buckets[1].scans.map((s) => s.id)).toEqual([3]);
  });

  it('behaves exactly as before when no resolver is supplied', () => {
    const buckets = computeBuckets([
      scan(1, '2026-08-16T16:56:00.000Z', 10),
      scan(2, '2026-08-16T17:02:00.000Z', 10),
    ]);
    expect(buckets).toHaveLength(1);
  });
});
