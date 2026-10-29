/**
 * Over-the-air JS updates (EAS Update). Checked silently on cold start and every few hours
 * on foreground (AppConfigGate): a newer bundle is fetched in the background and — since
 * 2026-10-11 — applied the next time the app comes back from the background after a real
 * absence (reloadIfReady), not only at the next cold start: a teacher who never quits the
 * app used to carry a fix around for days. Never mid-session: a reload is a restart.
 *
 * expo-updates is loaded via a guarded require so this runs where the module is missing
 * (Jest, Expo Go) as a no-op.
 */
type UpdatesApi = {
  isEnabled: boolean;
  updateId: string | null;
  runtimeVersion: string | null;
  isEmbeddedLaunch: boolean;
  checkForUpdateAsync: () => Promise<{ isAvailable?: boolean }>;
  fetchUpdateAsync: () => Promise<{ isNew?: boolean }>;
  reloadAsync: () => Promise<void>;
};

let api: UpdatesApi | null | undefined;
/** A newer bundle is on the phone, waiting for a restart. */
let downloaded = false;

function load(): UpdatesApi | null {
  if (api !== undefined) return api;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    api = require('expo-updates') as UpdatesApi;
  } catch {
    api = null; // not installed — scaffold state
  }
  return api;
}

export async function checkForOtaUpdate(): Promise<void> {
  const Updates = load();
  if (!Updates?.isEnabled || downloaded) return;
  try {
    const res = await Updates.checkForUpdateAsync();
    if (res?.isAvailable) {
      const fetched = await Updates.fetchUpdateAsync();
      if (fetched?.isNew !== false) downloaded = true;
    }
  } catch {
    // Bad network / server down — silent, by design.
  }
}

/** The app was in the background at least this long: a restart now interrupts nothing. */
export const RELOAD_AFTER_BACKGROUND_MS = 2 * 60_000;

/**
 * Apply a downloaded update by restarting the JS — only when the person has clearly been
 * away (the app sat in the background for RELOAD_AFTER_BACKGROUND_MS or more), so a
 * teacher mid-scan or mid-payment is never cut off. Returns true when it reloads.
 */
export async function reloadIfReady(backgroundedForMs: number): Promise<boolean> {
  const Updates = load();
  if (!Updates?.isEnabled || !downloaded || backgroundedForMs < RELOAD_AFTER_BACKGROUND_MS) return false;
  try {
    await Updates.reloadAsync();
    return true;
  } catch {
    return false; // next cold start applies it anyway
  }
}

/**
 * For a reload request from ops (src/updates/reloadRequest.ts): make sure the newest bundle is
 * on the phone, now. Returns 'pending' when one is downloaded and waiting for a restart, 'none'
 * when this phone is already up to date, 'off' when updates don't run here (dev, Expo Go,
 * Jest), 'error' when the check could not finish (no network) — the caller asks again later.
 */
export async function prepareReload(): Promise<'pending' | 'none' | 'off' | 'error'> {
  const Updates = load();
  if (!Updates?.isEnabled) return 'off';
  if (downloaded) return 'pending';
  try {
    const res = await Updates.checkForUpdateAsync();
    if (!res?.isAvailable) return 'none';
    await Updates.fetchUpdateAsync();
    // isNew false = it was already downloaded earlier; either way it waits for a restart.
    downloaded = true;
    return 'pending';
  } catch {
    return 'error';
  }
}

/** Restart the JS now, into the newest bundle on the phone. False when it cannot. */
export async function restartNow(): Promise<boolean> {
  const Updates = load();
  if (!Updates?.isEnabled) return false;
  try {
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}

/** What runs right now, for an error report: the embedded bundle or an update's id. */
export function runningUpdate(): { update_id: string | null; runtime: string | null; embedded: boolean } {
  const Updates = load();
  if (!Updates?.isEnabled) return { update_id: null, runtime: null, embedded: true };
  return { update_id: Updates.updateId ?? null, runtime: Updates.runtimeVersion ?? null, embedded: !!Updates.isEmbeddedLaunch };
}

/** Test seam. */
export function __resetOtaForTests(): void { api = undefined; downloaded = false; }
