/**
 * The headless pass (src/background/refreshTask.ts): runs only with a route out and a
 * signed-in teacher, hydrates the session from disk, sends what was parked, warms the
 * cache, and — with no root layout around — writes the cache back to disk itself.
 */
const mockDefineTask = jest.fn();
const mockIsRegistered = jest.fn(async () => false);
const mockRegister = jest.fn(async () => undefined);
const mockUnregister = jest.fn(async () => undefined);
const mockStatus = jest.fn(async () => 2);
jest.mock('expo-task-manager', () => ({ defineTask: mockDefineTask, isTaskRegisteredAsync: mockIsRegistered }));
jest.mock('expo-background-task', () => ({
  registerTaskAsync: mockRegister, unregisterTaskAsync: mockUnregister, getStatusAsync: mockStatus,
  BackgroundTaskStatus: { Restricted: 1, Available: 2 }, BackgroundTaskResult: { Success: 1, Failed: 2 },
}));
const mockFetch = jest.fn();
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { fetch: mockFetch } }));

const mockAuthState: Record<string, unknown> = {};
const mockHydrate = jest.fn(async () => { Object.assign(mockAuthState, { isLoading: false, isAuthenticated: true, role: 'teacher', impersonation: null }); });
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ ...mockAuthState, hydrate: mockHydrate }) } }));
const mockSetOnline = jest.fn();
const mockRefresh = jest.fn(async () => undefined);
jest.mock('@/stores/offlineStore', () => ({ useOfflineStore: { getState: () => ({ online: true, link: 'wifi', setOnline: mockSetOnline, refresh: mockRefresh }) } }));

let mockLiveClient: unknown = null;
const mockSetQueryClient = jest.fn();
jest.mock('@/lib/queryClientRef', () => ({ getQueryClient: () => mockLiveClient, setQueryClient: mockSetQueryClient }));
const mockRestore = jest.fn(async () => undefined);
const mockPersist = jest.fn(async () => undefined);
jest.mock('@/lib/queryPersist', () => ({ persistBuster: '1.0.0', queryPersister: { restoreClient: mockRestore, persistClient: mockPersist } }));
jest.mock('@/db/offlineScans', () => ({ initOfflineScans: async () => undefined }));
jest.mock('@/db/offlineMarks', () => ({ initOfflineMarks: async () => undefined }));
jest.mock('@/db/outbox', () => ({ initOutbox: async () => undefined }));
const mockAutoSync = jest.fn(async () => 2);
jest.mock('@/db/autoSync', () => ({ runAutoSync: mockAutoSync }));
const mockWarmUp = jest.fn(async () => undefined);
jest.mock('@/db/warmUp', () => ({ warmUpOfflineScreens: mockWarmUp }));
const mockNote = jest.fn(async () => undefined);
jest.mock('../lastRun', () => ({ noteBackgroundRun: mockNote }));

// Required AFTER the mocks above exist: an `import` is hoisted over them, and the module defines
// its task at load time.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BACKGROUND_REFRESH_TASK, MINIMUM_INTERVAL_MINUTES, registerBackgroundRefresh, runBackgroundRefresh, unregisterBackgroundRefresh } = require('../refreshTask') as typeof import('../refreshTask');
// Captured before beforeEach clears the mocks: what loading the module did.
const definedAtLoad = mockDefineTask.mock.calls.map((c) => c[0]);

beforeEach(() => {
  jest.clearAllMocks();
  mockLiveClient = null;
  Object.assign(mockAuthState, { isLoading: true, isAuthenticated: false, role: null, impersonation: null });
  mockFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true, type: 'wifi' });
  mockRestore.mockResolvedValue(undefined);
});

describe('runBackgroundRefresh', () => {
  it('is defined at import, in global scope, under one name', () => {
    expect(definedAtLoad).toEqual([BACKGROUND_REFRESH_TASK]);
  });

  it('does nothing without a route out', async () => {
    mockFetch.mockResolvedValue({ isConnected: false, type: 'none' });
    expect(await runBackgroundRefresh()).toBe('skipped');
    expect(mockHydrate).not.toHaveBeenCalled();
    expect(mockAutoSync).not.toHaveBeenCalled();
  });

  it('hydrates the session from disk when started headless, then sends and warms, and writes the cache back itself', async () => {
    expect(await runBackgroundRefresh()).toBe('done');
    expect(mockHydrate).toHaveBeenCalledTimes(1);
    expect(mockSetOnline).toHaveBeenCalledWith(true, 'wifi');
    expect(mockAutoSync).toHaveBeenCalledTimes(1);
    expect(mockWarmUp).toHaveBeenCalledTimes(1);
    // No root layout: a client of its own, restored from disk, given to the warm-up, saved after.
    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(mockSetQueryClient).toHaveBeenCalledTimes(1);
    expect(mockPersist).toHaveBeenCalledWith(expect.objectContaining({ buster: '1.0.0', clientState: expect.any(Object) }));
    expect(mockNote).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('uses the running app\'s client when there is one and leaves saving to its persister', async () => {
    mockLiveClient = { prefetchQuery: jest.fn() };
    Object.assign(mockAuthState, { isLoading: false, isAuthenticated: true, role: 'assistant', impersonation: null });
    expect(await runBackgroundRefresh()).toBe('done');
    expect(mockHydrate).not.toHaveBeenCalled();
    expect(mockRestore).not.toHaveBeenCalled();
    expect(mockPersist).not.toHaveBeenCalled();
    expect(mockSetQueryClient).not.toHaveBeenCalled();
  });

  it('never runs for a signed-out phone, a parent, or an impersonating admin', async () => {
    mockHydrate.mockImplementationOnce(async () => { Object.assign(mockAuthState, { isLoading: false, isAuthenticated: false }); });
    expect(await runBackgroundRefresh()).toBe('skipped');
    Object.assign(mockAuthState, { isLoading: false, isAuthenticated: true, role: 'parent' });
    expect(await runBackgroundRefresh()).toBe('skipped');
    Object.assign(mockAuthState, { role: 'teacher', impersonation: { active: true } });
    expect(await runBackgroundRefresh()).toBe('skipped');
    expect(mockAutoSync).not.toHaveBeenCalled();
  });

  it('keeps what was fetched when the pass fails half-way, and says so', async () => {
    mockWarmUp.mockRejectedValueOnce(new Error('boom'));
    expect(await runBackgroundRefresh()).toBe('failed');
    expect(mockPersist).toHaveBeenCalledTimes(1);
    expect(mockNote).toHaveBeenCalledTimes(1);
  });
});

describe('registration', () => {
  it('asks the OS once, at least every MINIMUM_INTERVAL_MINUTES, only where background work is available', async () => {
    expect(await registerBackgroundRefresh()).toBe(true);
    expect(mockRegister).toHaveBeenCalledWith(BACKGROUND_REFRESH_TASK, { minimumInterval: MINIMUM_INTERVAL_MINUTES });
    expect(MINIMUM_INTERVAL_MINUTES).toBeGreaterThanOrEqual(15);
    mockIsRegistered.mockResolvedValueOnce(true);
    expect(await registerBackgroundRefresh()).toBe(true);
    expect(mockRegister).toHaveBeenCalledTimes(1);
    mockStatus.mockResolvedValueOnce(1);
    expect(await registerBackgroundRefresh()).toBe(false);
  });

  it('is undone at sign-out', async () => {
    mockIsRegistered.mockResolvedValueOnce(true);
    await unregisterBackgroundRefresh();
    expect(mockUnregister).toHaveBeenCalledWith(BACKGROUND_REFRESH_TASK);
  });
});
