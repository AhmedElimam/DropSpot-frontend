/**
 * Runtime override of the API base URL (super-admin "repoint the app" feature).
 *
 * Safety model — a wrong value can NEVER lock users out:
 *  - The app ships with a bundled URL (see client.ts) and only ADOPTS a remote
 *    override AFTER a successful health-check (appConfigSync).
 *  - If an adopted override later becomes unreachable, the next sync CLEARS it and
 *    the app falls back to the bundled URL.
 *
 * This is a leaf module (only a lazy AsyncStorage require) so client.ts can read the
 * override synchronously on every request without pulling network/i18n deps.
 */
const KEY = 'app_config.api_base';

let override: string | null = null;
let hydrated = false;
let hydrating: Promise<void> | null = null;

function store(): {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
} | null {
  try {
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
}

/** Load the persisted override once (memoised). Safe to await on every request. */
export async function ensureApiBaseHydrated(): Promise<void> {
  if (hydrated) return;
  if (!hydrating) {
    hydrating = (async () => {
      try {
        const v = await store()?.getItem(KEY);
        override = v && v.trim() ? v.trim() : null;
      } catch {
        override = null;
      }
      hydrated = true;
    })();
  }
  await hydrating;
}

export function getApiBaseOverride(): string | null {
  return override;
}

/** Adopt (or clear, with null) the override and persist it. */
export async function setApiBaseOverride(value: string | null): Promise<void> {
  override = value && value.trim() ? value.trim() : null;
  hydrated = true;
  try {
    const s = store();
    if (!s) return;
    if (override) await s.setItem(KEY, override);
    else await s.removeItem(KEY);
  } catch {
    // Best-effort persistence — the in-memory value still applies this session.
  }
}
