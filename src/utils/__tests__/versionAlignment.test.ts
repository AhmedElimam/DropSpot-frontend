import fs from 'fs';
import path from 'path';
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

  // Since 2026-10-11 the runtime is a FINGERPRINT of the native layer, not the version
  // number: one update reaches iOS and Android alike however far their store versions have
  // drifted, and can never land on a binary whose native code differs. A local ios/ must
  // not change the hash CI computes (.fingerprintignore).
  it('OTA runtime is the native fingerprint, so one update reaches every matching binary and never a different one', () => {
    expect(appJson.expo.runtimeVersion).toEqual({ policy: 'fingerprint' });
    expect(appJson.expo.updates?.requestHeaders?.['expo-channel-name']).toBe('production');
    const ignore = fs.readFileSync(path.join(__dirname, '../../../.fingerprintignore'), 'utf8');
    expect(ignore).toContain('ios/**');
    expect(ignore).toContain('android/**');
  });

  it('Android has a versionCode floor for local builds (CI stamps the run number above it)', () => {
    expect(Number.isInteger(appJson.expo.android.versionCode)).toBe(true);
    expect(appJson.expo.android.versionCode).toBeGreaterThan(0);
  });

  // The floor is what App Store Connect has already seen; CI's run counter is independent
  // of it and resets if a workflow is renamed, so a build must never be stamped below it.
  it('iOS has a numeric buildNumber floor', () => {
    expect(appJson.expo.ios.buildNumber).toMatch(/^\d+$/);
    expect(parseInt(appJson.expo.ios.buildNumber, 10)).toBeGreaterThan(0);
  });
});
