const mockPost = jest.fn(async () => ({}));
jest.mock('@/api/client', () => ({ __esModule: true, default: { post: (...a: unknown[]) => mockPost(...(a as [])) } }));
jest.mock('@/utils/deviceId', () => ({ getDeviceId: async () => 'dev-1' }));
let mockPending = 0;
jest.mock('@/db/offlineScans', () => ({ countPendingScans: async () => mockPending, oldestPendingScanAt: async () => '2026-10-19T10:00:00Z' }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.9' } } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sendDeviceHeartbeat, HEARTBEAT_IDLE_MS } = require('../device') as typeof import('../device');

describe('the device heartbeat speaks only when it has news', () => {
  it('launch sends; an idle foreground a minute later does not; waiting scans do; 15 min idle does', async () => {
    const t0 = Date.now();
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(t0);
    await sendDeviceHeartbeat(1, true);                 // launch
    expect(mockPost).toHaveBeenCalledTimes(1);

    now.mockReturnValue(t0 + 61_000);
    await sendDeviceHeartbeat(1);                       // nothing waiting, nothing changed
    expect(mockPost).toHaveBeenCalledTimes(1);

    mockPending = 3;
    now.mockReturnValue(t0 + 122_000);
    await sendDeviceHeartbeat(1);                       // scans waiting → reported
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect((mockPost.mock.calls[1] as unknown[])[1]).toMatchObject({ pending_scan_count: 3, oldest_pending_at: '2026-10-19T10:00:00Z' });

    mockPending = 0;
    now.mockReturnValue(t0 + 183_000);
    await sendDeviceHeartbeat(1);                       // the count moved back to 0 → reported once
    expect(mockPost).toHaveBeenCalledTimes(3);
    now.mockReturnValue(t0 + 244_000);
    await sendDeviceHeartbeat(1);
    expect(mockPost).toHaveBeenCalledTimes(3);

    now.mockReturnValue(t0 + 183_000 + HEARTBEAT_IDLE_MS);
    await sendDeviceHeartbeat(1);                       // idle keep-alive
    expect(mockPost).toHaveBeenCalledTimes(4);
    now.mockRestore();
  });
});
