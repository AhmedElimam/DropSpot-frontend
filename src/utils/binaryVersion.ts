import Constants from 'expo-constants';

/**
 * The STORE build's version — what the phone actually has installed — for the update lock
 * and the build census.
 *
 * `Constants.expoConfig.version` is not that: once a soft update (OTA) is running it is the
 * version written in the update's manifest, i.e. app.json at publish time. Publishing from a
 * 1.2.9 checkout to the 1.2.8 runtimes made those phones report 1.2.9, so an iOS floor of
 * 1.2.9 let them through (founder 2026-10-18: «locked supported versions, didn't lock iphone»).
 *
 * The native version comes from expo-application, compiled into every store build (it is a
 * dependency of expo-notifications). Required lazily and guarded: if it is ever missing,
 * fall back to the old reading rather than block anyone.
 */
export function binaryVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const native = require('expo-application').nativeApplicationVersion as string | null | undefined;
    if (native && /^\d+(\.\d+)*$/.test(native)) return native;
  } catch { /* no native module: fall through */ }
  return Constants.expoConfig?.version ?? '0.0.0';
}
