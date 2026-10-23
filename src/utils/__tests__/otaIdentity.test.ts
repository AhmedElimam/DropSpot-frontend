/**
 * X-App-Update / X-App-Bundle (src/utils/otaIdentity.ts): what the DevOps page's OTA tracker
 * counts. An OTA reports its id and the commit it was published from; a store build's own
 * bundle reports `embedded`.
 */
describe('otaIdentity', () => {
  afterEach(() => { jest.resetModules(); delete process.env.EXPO_PUBLIC_BUNDLE_COMMIT; });

  it('an OTA: its update id and the commit written in at publish time', () => {
    jest.doMock('expo-updates', () => ({ isEmbeddedLaunch: false, updateId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b' }));
    process.env.EXPO_PUBLIC_BUNDLE_COMMIT = 'ac3469d5f58aa94c562d0297d1f8068786633ffe';
    const { otaIdentity } = require('../otaIdentity');
    expect(otaIdentity()).toEqual({ update: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', bundle: 'ac3469d5f58a' });
  });

  it('the store build’s own bundle', () => {
    jest.doMock('expo-updates', () => ({ isEmbeddedLaunch: true, updateId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b' }));
    const { otaIdentity } = require('../otaIdentity');
    expect(otaIdentity()).toEqual({ update: 'embedded', bundle: 'embedded' });
  });
});
