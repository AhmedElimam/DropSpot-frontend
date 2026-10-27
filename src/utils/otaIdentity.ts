/**
 * Which OTA this phone runs, for the OTA tracker on /admin/delivery (founder 2026-10-23): sent
 * as X-App-Update (the update's id) and X-App-Bundle (the commit it was published from) next to
 * X-App-Version, and kept per person by the server's build census.
 *
 * The commit is written into the bundle at publish time (scripts/ota-store-builds.sh sets
 * EXPO_PUBLIC_BUNDLE_COMMIT). A store build's own bundle reports `embedded`; Metro reports `dev`.
 * expo-updates is required lazily and guarded, like binaryVersion: never fail a request over it.
 */
let cached: { update: string; bundle: string } | null = null;

export function otaIdentity(): { update: string; bundle: string } {
  if (cached) return cached;
  let update = 'dev';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require('expo-updates') as { isEmbeddedLaunch?: boolean; updateId?: string | null };
    update = Updates.isEmbeddedLaunch ? 'embedded' : (Updates.updateId ?? 'dev');
  } catch { /* no native module (tests, web): dev */ }
  const commit = (process.env.EXPO_PUBLIC_BUNDLE_COMMIT ?? '').trim().slice(0, 12);
  cached = { update, bundle: update === 'embedded' || update === 'dev' ? update : commit || 'unknown' };
  return cached;
}
