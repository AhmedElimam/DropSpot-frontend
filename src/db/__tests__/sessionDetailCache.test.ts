const mockStore = new Map<string, string>();
const mockRemovedLegacy: string[] = [];

jest.mock('expo-sqlite/kv-store', () => ({
  SQLiteStorage: class {
    getItemAsync = async (k: string) => mockStore.get(k) ?? null;
    setItemAsync = async (k: string, v: string | ((prev: string | null) => string)) => {
      mockStore.set(k, typeof v === 'function' ? v(mockStore.get(k) ?? null) : v);
    };
    removeItemAsync = async (k: string) => mockStore.delete(k);
  },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { removeItem: async (k: string) => { mockRemovedLegacy.push(k); } },
}));

import { cacheSessionDetail, cachedSessionAge, pruneSessionDetailCache, readCachedSessionDetail } from '../sessionDetailCache';
import type { SessionDetail } from '@/api/teacherSessions';

const detail = (id: number) => ({ id: String(id), attendees: [] } as unknown as SessionDetail);
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => { mockStore.clear(); mockRemovedLegacy.length = 0; });

describe('sessionDetailCache', () => {
  it('saves one row per session and reads it back with its age', async () => {
    await cacheSessionDetail(7, detail(7), 1_000_000);
    await cacheSessionDetail(8, detail(8), 1_000_500);
    expect(mockStore.has('sd:7')).toBe(true);
    expect(mockStore.has('sd:8')).toBe(true);
    expect((await readCachedSessionDetail(7, 1_000_900))?.at).toBe(1_000_000);
    expect(await cachedSessionAge(8, 1_001_000)).toBe(500);
    expect(await cachedSessionAge(9, 1_001_000)).toBeNull();
  });

  it('saving one sheet touches only that row and the small index', async () => {
    await cacheSessionDetail(1, detail(1), 1);
    const before = mockStore.get('sd:1');
    await cacheSessionDetail(2, detail(2), 2);
    expect(mockStore.get('sd:1')).toBe(before);
    expect(JSON.parse(mockStore.get('index')!)).toEqual({ '1': 1, '2': 2 });
  });

  it('forgets a sheet after two days, on read and on the once-per-open prune', async () => {
    await cacheSessionDetail(3, detail(3), 0);
    await cacheSessionDetail(4, detail(4), 2 * DAY - 1000);
    expect(await readCachedSessionDetail(3, 2 * DAY + 1)).toBeNull();
    expect(await cachedSessionAge(3, 2 * DAY + 1)).toBeNull();
    await pruneSessionDetailCache(2 * DAY + 1);
    expect(mockStore.has('sd:3')).toBe(false);
    expect(mockStore.has('sd:4')).toBe(true);
    expect(JSON.parse(mockStore.get('index')!)).toEqual({ '4': 2 * DAY - 1000 });
  });

  it('clears the old one-blob store on prune', async () => {
    await pruneSessionDetailCache();
    expect(mockRemovedLegacy).toEqual(['session_detail_cache_v1']);
  });
});
