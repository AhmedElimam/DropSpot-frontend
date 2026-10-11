const mockKv: Record<string, string> = {};
const mockSet = jest.fn(async (k: string, v: string) => { mockKv[k] = v; });
jest.mock('expo-sqlite/kv-store', () => ({ SQLiteStorage: class { getItemAsync = async (k: string) => mockKv[k] ?? null; setItemAsync = mockSet; removeItemAsync = async (k: string) => { delete mockKv[k]; }; } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.9' } } }));
const mockAfter = jest.fn((cb: () => void) => { cb(); return { then: () => undefined, done: () => undefined, cancel: () => undefined }; });
let mockAppState: ((s: string) => void) | null = null;
jest.mock('react-native', () => ({
  InteractionManager: { runAfterInteractions: (cb: () => void) => mockAfter(cb) },
  AppState: { addEventListener: (_: string, cb: (s: string) => void) => { mockAppState = cb; return { remove: () => undefined }; } },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { queryPersister, flushPersistedQueries, WRITE_EVERY_MS } = require('../queryPersist') as typeof import('../queryPersist');

const snapshot = (n: number) => ({ buster: '1.2.9', timestamp: n, clientState: { mutations: [], queries: [] } });

beforeEach(() => { jest.useFakeTimers(); mockSet.mockClear(); mockAfter.mockClear(); for (const k of Object.keys(mockKv)) delete mockKv[k]; });
afterEach(() => { jest.useRealTimers(); });

describe('the query cache on disk writes when the phone is idle, not on every change', () => {
  it('coalesces a burst of changes into one write after the interactions, and keeps the newest snapshot', async () => {
    queryPersister.persistClient(snapshot(1));
    queryPersister.persistClient(snapshot(2));
    queryPersister.persistClient(snapshot(3));
    expect(mockSet).not.toHaveBeenCalled();
    jest.advanceTimersByTime(WRITE_EVERY_MS + 10);
    await flushPersistedQueries();
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockKv['rq-cache-v1']).timestamp).toBe(3);
    expect(mockAfter).toHaveBeenCalled(); // serialised after interactions, never inside one
  });

  it('writes at once when the app leaves the foreground', async () => {
    queryPersister.persistClient(snapshot(7));
    mockAppState?.('background');
    await flushPersistedQueries();
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockKv['rq-cache-v1']).timestamp).toBe(7);
  });

  it('restores what it wrote and forgets it on request', async () => {
    queryPersister.persistClient(snapshot(9));
    await flushPersistedQueries();
    expect((await queryPersister.restoreClient())?.timestamp).toBe(9);
    await queryPersister.removeClient();
    expect(await queryPersister.restoreClient()).toBeUndefined();
  });
});
