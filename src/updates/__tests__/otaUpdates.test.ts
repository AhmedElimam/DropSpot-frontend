const mockUpdates = {
  isEnabled: true, updateId: 'u-1', runtimeVersion: 'fp-abc', isEmbeddedLaunch: false,
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
  fetchUpdateAsync: jest.fn(async () => ({ isNew: true })),
  reloadAsync: jest.fn(async () => undefined),
};
jest.mock('expo-updates', () => mockUpdates, { virtual: true });

import { RELOAD_AFTER_BACKGROUND_MS, __resetOtaForTests, checkForOtaUpdate, reloadIfReady, runningUpdate } from '../otaUpdates';

beforeEach(() => { jest.clearAllMocks(); __resetOtaForTests(); mockUpdates.isEnabled = true; });

describe('OTA updates', () => {
  it('fetches a newer bundle quietly and applies it only on return from a real absence', async () => {
    expect(await reloadIfReady(10 * 60_000)).toBe(false); // nothing downloaded yet
    await checkForOtaUpdate();
    expect(mockUpdates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(await reloadIfReady(RELOAD_AFTER_BACKGROUND_MS - 1)).toBe(false); // a quick app switch: never a restart
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    expect(await reloadIfReady(RELOAD_AFTER_BACKGROUND_MS)).toBe(true);
    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('checks once per downloaded bundle, and does nothing where updates are disabled', async () => {
    await checkForOtaUpdate();
    await checkForOtaUpdate();
    expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    __resetOtaForTests();
    mockUpdates.isEnabled = false;
    await checkForOtaUpdate();
    expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(runningUpdate()).toEqual({ update_id: null, runtime: null, embedded: true });
  });

  it('names what runs, for an error report', () => {
    expect(runningUpdate()).toEqual({ update_id: 'u-1', runtime: 'fp-abc', embedded: false });
  });
});
