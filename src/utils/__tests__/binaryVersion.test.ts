/** The update lock must read the installed store build, not the OTA manifest's version. */
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.9' } } }));

describe('binaryVersion', () => {
  afterEach(() => { jest.resetModules(); jest.dontMock('expo-application'); });

  it('prefers the native store version over the OTA manifest', () => {
    jest.doMock('expo-application', () => ({ nativeApplicationVersion: '1.2.8' }));
    const { binaryVersion } = require('../binaryVersion');
    expect(binaryVersion()).toBe('1.2.8');
  });

  it('falls back to the manifest when the native version is missing or odd', () => {
    jest.doMock('expo-application', () => ({ nativeApplicationVersion: null }));
    expect(require('../binaryVersion').binaryVersion()).toBe('1.2.9');
    jest.resetModules();
    jest.doMock('expo-application', () => ({ nativeApplicationVersion: '1.2.8 (beta)' }));
    expect(require('../binaryVersion').binaryVersion()).toBe('1.2.9');
  });

  it('falls back when the native module throws', () => {
    jest.doMock('expo-application', () => { throw new Error('no native module'); });
    expect(require('../binaryVersion').binaryVersion()).toBe('1.2.9');
  });
});
