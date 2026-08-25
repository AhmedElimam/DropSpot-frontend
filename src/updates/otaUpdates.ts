/**
 * Silent, non-blocking OTA update check (Mechanism A). Fetches a newer JS bundle
 * in the background and lets it activate on the NEXT launch — it never reloads
 * mid-session or blocks the UI, and a failed check is a no-op.
 *
 * expo-updates is loaded via a guarded require so this compiles and runs whether
 * or not the package is installed yet (it's inert in Expo Go / dev and until the
 * founder runs `npx expo install expo-updates` + a native rebuild). See
 * OTA_AND_CONFIG.md for activation + rollback.
 */
export async function checkForOtaUpdate(): Promise<void> {
  let Updates: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Updates = require('expo-updates');
  } catch {
    return; // not installed (scaffold state) — no-op
  }

  try {
    if (!Updates?.isEnabled) return; // disabled in dev client / Expo Go
    const res = await Updates.checkForUpdateAsync();
    if (res?.isAvailable) {
      await Updates.fetchUpdateAsync();
      // Downloaded — it activates on next cold start. Never Updates.reloadAsync()
      // here: a teacher mid-scan must not be interrupted by a reload.
    }
  } catch {
    // Bad network / server down — silent, by design.
  }
}
