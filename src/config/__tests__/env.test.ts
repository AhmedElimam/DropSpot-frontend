/**
 * stg.drosspot.app (founder 2026-10-12): a staging build is a separate app that only talks
 * to the staging server and carries its key; absent the variable, everything is production.
 */
const load = (env: Record<string, string | undefined>) => {
  jest.resetModules();
  const prev = { ...process.env };
  Object.assign(process.env, env);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../env') as typeof import('../env');
  process.env = prev;
  return mod;
};

describe('build environment', () => {
  it('is production unless EXPO_PUBLIC_APP_ENV says staging, and never carries a key then', () => {
    const p = load({ EXPO_PUBLIC_APP_ENV: undefined, EXPO_PUBLIC_STAGING_KEY: 'leak' });
    expect(p.APP_ENV).toBe('production');
    expect(p.IS_STAGING).toBe(false);
    expect(p.STAGING_KEY).toBeNull();
    const junk = load({ EXPO_PUBLIC_APP_ENV: 'stagingg' });
    expect(junk.IS_STAGING).toBe(false);
  });

  it('a staging build knows it, and carries the door key', () => {
    const s = load({ EXPO_PUBLIC_APP_ENV: 'staging', EXPO_PUBLIC_STAGING_KEY: 'k-123' });
    expect(s.IS_STAGING).toBe(true);
    expect(s.STAGING_KEY).toBe('k-123');
    expect(s.STAGING_HEADER).toBe('X-Staging-Key');
  });
});

describe('app.config: the staging app is a separate app', () => {
  const configFor = (env: Record<string, string | undefined>, filesExist = true) => {
    jest.resetModules();
    jest.doMock('fs', () => ({ existsSync: () => filesExist }));
    const prev = { ...process.env };
    Object.assign(process.env, env);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const make = (require('../../../app.config') as { default: (c: { config: Record<string, unknown> }) => Record<string, any> }).default;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const appJson = require('../../../app.json').expo;
      return make({ config: appJson });
    } finally {
      process.env = prev;
      jest.dontMock('fs');
    }
  };

  it('production keeps its identity, channel and Firebase file', () => {
    const c = configFor({ EXPO_PUBLIC_APP_ENV: undefined });
    expect(c.name).toBe('DrosSpot');
    expect(c.ios.bundleIdentifier).toBe('com.drosspot.app');
    expect(c.android.package).toBe('com.drosspot.app');
    expect(c.android.googleServicesFile).toBe('./google-services.json');
    expect(c.updates.requestHeaders['expo-channel-name']).toBe('production');
    expect(c.extra.appId).toBe('com.drosspot.app');
    expect(c.scheme).toBe('drosspot');
  });

  it('staging is its own app on its own OTA channel, and refuses to build without its Firebase file', () => {
    const c = configFor({ EXPO_PUBLIC_APP_ENV: 'staging' });
    expect(c.name).toBe('DrosSpot Staging');
    expect(c.ios.bundleIdentifier).toBe('com.drosspot.app.stg');
    expect(c.android.package).toBe('com.drosspot.app.stg');
    expect(c.android.googleServicesFile).toBe('./google-services.staging.json');
    expect(c.updates.requestHeaders['expo-channel-name']).toBe('staging');
    expect(c.extra.appId).toBe('com.drosspot.app.stg');
    expect(c.extra.appEnv).toBe('staging');
    expect(c.scheme).toBe('drosspot-stg');
    expect(() => configFor({ EXPO_PUBLIC_APP_ENV: 'staging' }, false)).toThrow(/google-services.staging.json/);
  });
});
