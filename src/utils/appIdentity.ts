import Constants from 'expo-constants';

/**
 * This build's app identity (bundle id / package name), stamped on every API request
 * as X-App-Id.
 *
 * It is what lets the server retire ONE published app — the one on a developer
 * account we share — while the successor app keeps working. So resolving it wrongly
 * has an asymmetric cost: a missing value is read by the server as the LEGACY app,
 * which is exactly the identity the switch is aimed at. A successor build that fails
 * to identify itself would therefore kill itself.
 *
 * Hence the order below, most authoritative first:
 *   1. expo-application — the real native application id, read from the binary.
 *      Loaded through a guarded require so this file works whether or not the
 *      package is installed (same pattern as the OTA check).
 *   2. extra.appId — baked into app.json; `extra` is reliably present in
 *      Constants.expoConfig at runtime, unlike the ios/android sections.
 *   3. The ios/android manifest sections, when they happen to be there.
 */
export function resolveAppId(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Application = require('expo-application');
    const nativeId = Application?.applicationId;
    if (typeof nativeId === 'string' && nativeId !== '') return nativeId;
  } catch {
    // Not installed — fall through to the manifest.
  }

  const cfg = Constants.expoConfig;
  const fromExtra = cfg?.extra?.appId;
  if (typeof fromExtra === 'string' && fromExtra !== '') return fromExtra;

  return cfg?.ios?.bundleIdentifier ?? cfg?.android?.package ?? null;
}
