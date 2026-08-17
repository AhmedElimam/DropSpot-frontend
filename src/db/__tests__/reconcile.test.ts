// Mock the storage layer so reconcile logic can be tested without expo-sqlite.
// The factory returns no real module, so importing reconcile never loads native code.
jest.mock('@/db/offlineScans', () => ({
  deleteScans: jest.fn(async () => {}),
  markScanRejected: jest.fn(async () => {}),
}));

import { applyBatchResults, suggestSessionId, confidentSessionId } from '@/db/reconcile';
import { deleteScans, markScanRejected } from '@/db/offlineScans';
import type { OfflineScan } from '@/db/offlineScans';
import type { ScanBucket } from '@/db/buckets';
import type { TeacherSession, OfflineScanResult } from '@/api/teacher';

const mockDeleteScans = deleteScans as jest.MockedFunction<typeof deleteScans>;
const mockMarkRejected = markScanRejected as jest.MockedFunction<typeof markScanRejected>;

function localScan(id: number, card_code: string): OfflineScan {
  return { id, card_code, scanned_at: '2026-08-16T09:00:00.000Z', teacher_id: null, last_error: null, status: 'pending' };
}
function bucketOf(scans: OfflineScan[]): ScanBucket {
  return { startTime: scans[0]?.scanned_at ?? '', endTime: scans[scans.length - 1]?.scanned_at ?? '', teacherId: null, scans };
}
function result(card_code: string, outcome: OfflineScanResult['outcome'], code: string | null = null): OfflineScanResult {
  return { card_code, outcome, code, message: code ?? outcome, student_name: null };
}
function session(id: string, scheduled_at: string, duration_minutes = 60): TeacherSession {
  return { id, scheduled_at, duration_minutes, course_name: `Course ${id}` } as unknown as TeacherSession;
}

beforeEach(() => {
  mockDeleteScans.mockClear();
  mockMarkRejected.mockClear();
});

describe('applyBatchResults — per-scan outcome handling (§1) + permanent rejection (§2)', () => {
  it('resolves a mixed batch independently: delete synced/already_recorded, reject failed', async () => {
    const bucket = bucketOf([localScan(1, 'A'), localScan(2, 'B'), localScan(3, 'C')]);
    const results = [
      result('A', 'synced'),
      result('B', 'failed', 'NOT_ENROLLED'),
      result('C', 'already_recorded', 'ALREADY_CHECKED_IN'),
    ];

    const out = await applyBatchResults(bucket, results);

    expect(out).toEqual({ synced: 2, rejected: 1 });
    expect(mockDeleteScans).toHaveBeenCalledWith([1, 3]); // A + C safely on server
    expect(mockMarkRejected).toHaveBeenCalledTimes(1);
    expect(mockMarkRejected).toHaveBeenCalledWith(2, 'NOT_ENROLLED'); // B needs a decision
  });

  it('maps by card_code, not by index, if the server returns a different order', async () => {
    const bucket = bucketOf([localScan(1, 'A'), localScan(2, 'B')]);
    // Results in reverse order of submission.
    const results = [result('B', 'synced'), result('A', 'failed', 'CARD_EXPIRED')];

    const out = await applyBatchResults(bucket, results);

    expect(out).toEqual({ synced: 1, rejected: 1 });
    expect(mockDeleteScans).toHaveBeenCalledWith([2]); // B (id 2), not A
    expect(mockMarkRejected).toHaveBeenCalledWith(1, 'CARD_EXPIRED'); // A (id 1)
  });

  it('consumes duplicate card codes in order (FIFO), never double-mapping one row', async () => {
    const bucket = bucketOf([localScan(1, 'A'), localScan(2, 'A')]); // same card twice
    const results = [result('A', 'synced'), result('A', 'failed', 'ALREADY_CHECKED_IN')];

    await applyBatchResults(bucket, results);

    expect(mockDeleteScans).toHaveBeenCalledWith([1]); // first A synced
    expect(mockMarkRejected).toHaveBeenCalledWith(2, 'ALREADY_CHECKED_IN'); // second A rejected
  });

  it('leaves a local row untouched when no result accounts for it (stays pending)', async () => {
    const bucket = bucketOf([localScan(1, 'A'), localScan(2, 'B')]);
    const results = [result('A', 'synced')]; // B got no verdict (short response)

    const out = await applyBatchResults(bucket, results);

    expect(out).toEqual({ synced: 1, rejected: 0 });
    expect(mockDeleteScans).toHaveBeenCalledWith([1]);
    expect(mockMarkRejected).not.toHaveBeenCalled(); // B not deleted, not rejected → still pending
  });

  it('ignores a result for a card not in the bucket', async () => {
    const bucket = bucketOf([localScan(1, 'A')]);
    const results = [result('A', 'synced'), result('Z', 'synced')]; // Z is foreign

    const out = await applyBatchResults(bucket, results);

    expect(out).toEqual({ synced: 1, rejected: 0 });
    expect(mockDeleteScans).toHaveBeenCalledWith([1]);
  });
});

describe('session disambiguation across a multi-day gap (§5)', () => {
  // Three occurrences of the same recurring class on three different days.
  const sessions = [
    session('day1', '2026-08-14T09:00:00.000Z'),
    session('day2', '2026-08-15T09:00:00.000Z'),
    session('day3', '2026-08-16T09:00:00.000Z'),
  ];

  it('suggests the single occurrence whose window contains the bucket start', () => {
    const bucket = bucketOf([{ ...localScan(1, 'A'), scanned_at: '2026-08-15T09:05:00.000Z' }]);
    expect(suggestSessionId(bucket, sessions)).toBe('day2');
    // Exactly one of the three candidates matches → confident.
    expect(confidentSessionId(bucket, sessions)).toBe('day2');
  });

  it('is not confident when two occurrences overlap the bucket start', () => {
    // Two sessions 20 min apart; a 30-min pre-window makes both match a start
    // that falls inside the second's pre-window and the first's live window.
    const overlapping = [
      session('early', '2026-08-16T09:00:00.000Z', 60),
      session('late', '2026-08-16T09:40:00.000Z', 60),
    ];
    const bucket = bucketOf([{ ...localScan(1, 'A'), scanned_at: '2026-08-16T09:30:00.000Z' }]);
    // Ambiguous → no confident id, but still a suggestion (first match) for one-tap.
    expect(confidentSessionId(bucket, overlapping)).toBeNull();
    expect(suggestSessionId(bucket, overlapping)).toBe('early');
  });

  it('suggests nothing when no occurrence contains the bucket start (original session gone)', () => {
    const bucket = bucketOf([{ ...localScan(1, 'A'), scanned_at: '2026-08-20T09:05:00.000Z' }]);
    expect(suggestSessionId(bucket, sessions)).toBeNull();
  });
});
