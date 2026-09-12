/**
 * The store version is declared ONCE — app.json → expo.version — and everything else
 * follows it: app.config.ts reads it, both CI workflows read it, package.json mirrors it.
 * If this fails, Android and iOS are about to ship under different names.
 */
import appJson from '../../../app.json';
import pkg from '../../../package.json';

describe('release version alignment', () => {
  const version = appJson.expo.version;

  it('is a plain X.Y.Z the server-side minimum can be compared against', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('package.json mirrors app.json', () => {
    expect(pkg.version).toBe(version);
  });

  it('OTA runtime follows the app version, so an update never lands on the wrong binary', () => {
    expect(appJson.expo.runtimeVersion).toEqual({ policy: 'appVersion' });
    expect(appJson.expo.updates?.requestHeaders?.['expo-channel-name']).toBe('production');
  });

  it('Android has a versionCode floor for local builds (CI stamps the run number above it)', () => {
    expect(Number.isInteger(appJson.expo.android.versionCode)).toBe(true);
    expect(appJson.expo.android.versionCode).toBeGreaterThan(0);
  });
});
