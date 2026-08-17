// In-memory AsyncStorage so the date-aware cache can be tested without native code.
jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store[k] ?? null),
      setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
      removeItem: jest.fn(async (k: string) => { delete store[k]; }),
      __reset: () => { store = {}; },
    },
  };
});
jest.mock('@/api/teacher', () => ({ getTeacherTodaySessions: jest.fn() }));
jest.mock('@/api/students', () => ({ getTeacherStudents: jest.fn() }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTeacherTodaySessions } from '@/api/teacher';
import { getTeacherStudents } from '@/api/students';
import {
  localDateKey,
  getFreshScheduleEntries,
  getFreshScheduleEntry,
  refreshScheduleCache,
  syncScheduleCacheOnOpen,
  buildGradeResolver,
  type ScheduleCacheEntry,
} from '@/db/scheduleCache';
import type { OfflineScan } from '@/db/offlineScans';

const reset = () => (AsyncStorage as any).__reset();
const mockSessions = getTeacherTodaySessions as jest.MockedFunction<typeof getTeacherTodaySessions>;
const mockStudents = getTeacherStudents as jest.MockedFunction<typeof getTeacherStudents>;

function scan(card_code: string, teacher_id: number | null = null): OfflineScan {
  return { id: 1, card_code, scanned_at: '2026-08-16T09:00:00.000Z', teacher_id, last_error: null, status: 'pending' };
}

// Seed one teacher's entry as if refreshed on `day` with the given roster.
async function seed(day: Date, teacherId: number | null, roster: any[], sessions: any[] = []): Promise<void> {
  mockSessions.mockResolvedValueOnce(sessions);
  mockStudents.mockResolvedValueOnce(roster);
  await refreshScheduleCache(teacherId, day);
}

beforeEach(() => {
  reset();
  mockSessions.mockReset();
  mockStudents.mockReset();
});

describe('localDateKey', () => {
  it('formats a device-local YYYY-MM-DD', () => {
    expect(localDateKey(new Date(2026, 7, 6))).toBe('2026-08-06'); // month is 0-based
  });
});

describe('per-entry staleness guard', () => {
  it('drops a stale-date entry but keeps another teacher’s still-valid entry', async () => {
    await seed(new Date(2026, 7, 15), 10, []); // teacher A: yesterday
    await seed(new Date(2026, 7, 16), 20, []); // teacher B: today

    const entries = await getFreshScheduleEntries(new Date(2026, 7, 16));
    expect(entries.map((e) => e.teacher_id)).toEqual([20]); // only B survives
    expect(await getFreshScheduleEntry(10, new Date(2026, 7, 16))).toBeNull(); // A pruned
    expect(await getFreshScheduleEntry(20, new Date(2026, 7, 16))).not.toBeNull();
  });
});

describe('refreshScheduleCache', () => {
  it('stamps date + teacher and maps roster grades', async () => {
    mockSessions.mockResolvedValue([{ id: 's1' } as any]);
    mockStudents.mockResolvedValue([{ id: '42', student_code: 'STU-42', grade_id: 1 } as any]);
    const entry = await refreshScheduleCache(10, new Date(2026, 7, 16));
    expect(entry).not.toBeNull();
    expect(entry!.date).toBe('2026-08-16');
    expect(entry!.teacher_id).toBe(10);
    expect(entry!.grades).toEqual([{ student_id: 42, student_code: 'STU-42', grade_id: 1 }]);
  });

  it('preserves other teachers’ today entries (never evicts on refresh)', async () => {
    await seed(new Date(2026, 7, 16), 10, [{ id: '1', student_code: 'SA', grade_id: 1 }]);
    await seed(new Date(2026, 7, 16), 20, [{ id: '2', student_code: 'SB', grade_id: 2 }]);
    const entries = await getFreshScheduleEntries(new Date(2026, 7, 16));
    expect(entries.map((e) => e.teacher_id).sort()).toEqual([10, 20]);
  });

  it('returns null and preserves prior state when the network fails (offline)', async () => {
    await seed(new Date(2026, 7, 16), 10, []);
    mockSessions.mockRejectedValue(new Error('offline'));
    expect(await refreshScheduleCache(10, new Date(2026, 7, 16))).toBeNull();
    expect(await getFreshScheduleEntry(10, new Date(2026, 7, 16))).not.toBeNull();
  });
});

describe('syncScheduleCacheOnOpen', () => {
  it('offline across a day boundary: prunes the stale entry, does not refresh', async () => {
    await seed(new Date(2026, 7, 15), 10, []); // yesterday
    mockSessions.mockClear();
    await syncScheduleCacheOnOpen(false, 10, new Date(2026, 7, 16));
    expect(mockSessions).not.toHaveBeenCalled();
    expect(await getFreshScheduleEntry(10, new Date(2026, 7, 16))).toBeNull();
  });

  it('online: refreshes the active teacher’s entry for today', async () => {
    mockSessions.mockResolvedValue([]);
    mockStudents.mockResolvedValue([]);
    await syncScheduleCacheOnOpen(true, 30, new Date(2026, 7, 16));
    expect(await getFreshScheduleEntry(30, new Date(2026, 7, 16))).not.toBeNull();
  });
});

// The direct test for the failure mode in the spec.
describe('cross-teacher isolation — an assistant working two teachers in one day', () => {
  it('resolves each scan against its OWN teacher, never the active one', async () => {
    const day = new Date(2026, 7, 16);
    // Morning: scanning for teacher A (id 10). A's student "SHARED" is grade 1.
    await seed(day, 10, [{ id: '1', student_code: 'SHARED', grade_id: 1 }]);
    // Afternoon: switched to teacher B (id 20), whose cache refreshes. B also has a
    // student with the SAME card code "SHARED" but grade 2 — the mix-up trap.
    await seed(day, 20, [
      { id: '2', student_code: 'SHARED', grade_id: 2 },
      { id: '3', student_code: 'SB', grade_id: 2 },
    ]);

    const entries = await getFreshScheduleEntries(day);
    expect(entries).toHaveLength(2); // A retained after B's refresh

    const resolve = buildGradeResolver(entries);
    // A's still-buffered scan (stamped teacher 10) must resolve against A's roster.
    expect(resolve(scan('SHARED', 10))).toBe(1);
    // B's scan (stamped teacher 20) resolves against B's roster.
    expect(resolve(scan('SHARED', 20))).toBe(2);
  });

  it('returns null when a scan’s teacher has no cached entry (fail-safe)', async () => {
    const day = new Date(2026, 7, 16);
    await seed(day, 10, [{ id: '1', student_code: 'SA', grade_id: 1 }]);
    const resolve = buildGradeResolver(await getFreshScheduleEntries(day));
    expect(resolve(scan('SA', 99))).toBeNull(); // no entry for teacher 99
  });
});

describe('buildGradeResolver — offline card→grade forms, fail-safe', () => {
  const entries: ScheduleCacheEntry[] = [
    {
      date: '2026-08-16',
      teacher_id: 10,
      sessions: [],
      grades: [
        { student_id: 42, student_code: 'STU-42', grade_id: 1 },
        { student_id: 99, student_code: 'STU-99', grade_id: 2 },
      ],
    },
  ];

  it('resolves the colon (signed) form by its leading student id', () => {
    expect(buildGradeResolver(entries)(scan('42:term:sig', 10))).toBe(1);
  });
  it('resolves a plain student_code (legacy card)', () => {
    expect(buildGradeResolver(entries)(scan('STU-99', 10))).toBe(2);
  });
  it('returns null for an opaque/unknown card (no split forced)', () => {
    expect(buildGradeResolver(entries)(scan('OPAQUExyz', 10))).toBeNull();
    expect(buildGradeResolver(entries)(scan('12345:term:sig', 10))).toBeNull();
  });
  it('resolves to null for every card when there are no entries', () => {
    expect(buildGradeResolver([])(scan('STU-42', 10))).toBeNull();
  });
});
