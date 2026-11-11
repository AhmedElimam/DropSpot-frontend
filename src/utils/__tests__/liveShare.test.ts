let mockAppState = 'active';
jest.mock('react-native', () => ({ AppState: { get currentState() { return mockAppState; } } }));
const mockRead = jest.fn(async () => ({ coords: { latitude: 30.1, longitude: 31.2, heading: null, speed: null } }));
let mockStarted = true;
const mockStop = jest.fn(async () => { mockStarted = false; });
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  getLastKnownPositionAsync: async () => null,
  getCurrentPositionAsync: () => mockRead(),
  hasStartedLocationUpdatesAsync: async () => mockStarted,
  stopLocationUpdatesAsync: (...a: unknown[]) => mockStop(...(a as [])),
  Accuracy: { Balanced: 3 },
}));
let mockSaved: string | null = null;
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: async () => mockSaved, setItem: async (_k: string, v: string) => { mockSaved = v; }, removeItem: async () => { mockSaved = null; } },
}));
const mockShare = jest.fn(async (..._a: unknown[]) => ({ sharing: true }));
jest.mock('@/api/print', () => ({ sharePrintLocation: (...a: unknown[]) => mockShare(...a), stopPrintLocation: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sendLiveBeat, readLiveShare } = require('../liveShare') as typeof import('../liveShare');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sampleFix, stopLegacyLocationTasks } = require('../foregroundLocation') as typeof import('../foregroundLocation');

beforeEach(() => { mockAppState = 'active'; mockRead.mockClear(); mockShare.mockClear(); mockStop.mockClear(); mockStarted = true; });

describe('location is foreground-only, one reading per beat', () => {
  it('two askers inside one beat cost one GPS reading', async () => {
    const a = await sampleFix(true);
    const b = await sampleFix();
    expect(a).toEqual(b);
    expect(mockRead).toHaveBeenCalledTimes(1);
  });
  it('nothing is read with the app in the background', async () => {
    mockAppState = 'background';
    expect(await sampleFix(true)).toBeNull();
    expect(mockRead).not.toHaveBeenCalled();
  });
  it('a background stream left by an older build is stopped', async () => {
    await stopLegacyLocationTasks();
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
});

describe('a live-location share never outlives its time', () => {
  it('a share still running its time sends the beat', async () => {
    mockSaved = JSON.stringify({ jobId: 4, until: Date.now() + 60_000 });
    const share = await readLiveShare();
    expect(await sendLiveBeat(share!)).toBe(true);
    expect(mockShare).toHaveBeenCalledWith(4, 30.1, 31.2, 'live');
  });
  it('time up — nothing is sent and the share is forgotten', async () => {
    mockSaved = JSON.stringify({ jobId: 4, until: Date.now() - 1 });
    expect(await readLiveShare()).toBeNull();
    expect(await sendLiveBeat({ jobId: 4, until: Date.now() - 1 })).toBe(false);
    expect(mockShare).not.toHaveBeenCalled();
    expect(mockSaved).toBeNull();
  });
  it('over on the server (trip closed) — the share is forgotten', async () => {
    mockSaved = JSON.stringify({ jobId: 4, until: Date.now() + 60_000 });
    mockShare.mockResolvedValueOnce({ sharing: false });
    expect(await sendLiveBeat({ jobId: 4, until: Date.now() + 60_000 })).toBe(false);
    expect(mockSaved).toBeNull();
  });
});
