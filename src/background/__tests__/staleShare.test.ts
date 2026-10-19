let mockStarted = true;
const mockStop = jest.fn(async () => { mockStarted = false; });
jest.mock('expo-location', () => ({
  hasStartedLocationUpdatesAsync: async () => mockStarted,
  stopLocationUpdatesAsync: (...a: unknown[]) => mockStop(...(a as [])),
  startLocationUpdatesAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
let mockSaved: string | null = null;
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: async () => mockSaved, setItem: async (_k: string, v: string) => { mockSaved = v; }, removeItem: async () => { mockSaved = null; } },
}));
jest.mock('@/api/print', () => ({}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { stopStaleLiveShare } = require('../shareLocation') as typeof import('../shareLocation');

beforeEach(() => { mockStarted = true; mockStop.mockClear(); });

describe('a live-location share never outlives its time', () => {
  it('a share still running its time keeps going', async () => {
    mockSaved = JSON.stringify({ jobId: 4, until: Date.now() + 60_000 });
    await stopStaleLiveShare(true);
    expect(mockStop).not.toHaveBeenCalled();
  });
  it('time up — the GPS task stops even though no new location ever came', async () => {
    mockSaved = JSON.stringify({ jobId: 4, until: Date.now() - 1 });
    await stopStaleLiveShare(true);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
  it('print market switched off — any share stops', async () => {
    mockSaved = JSON.stringify({ jobId: 4, until: Date.now() + 60_000 });
    await stopStaleLiveShare(false);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
  it('nothing running — nothing to do', async () => {
    mockStarted = false;
    await stopStaleLiveShare(false);
    expect(mockStop).not.toHaveBeenCalled();
  });
});
