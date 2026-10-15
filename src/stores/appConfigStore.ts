import { create } from 'zustand';
import { CONFIG_DEFAULTS, type AppConfigPayload, type AppConfigRules } from '@/config/defaults';

const CACHE_KEY = 'app_config.last_good';

/**
 * Backend-driven config on the client. Load order (§4.2): bundled defaults →
 * last-good cache → server overlay. `config` is ALWAYS a complete, usable payload
 * — a failed fetch is a silent no-op that keeps last-good (or bundled) values,
 * never a blocked launch. schema_version-safe: unknown keys ignored, missing keys
 * fall back to bundled defaults (§4.5).
 *
 * Deliberately a LEAF module — only zustand + the bundled defaults. AsyncStorage is
 * lazy-required (never a top-level import) and the i18n/network sync lives in
 * appConfigSync, so pure consumers like src/db/buckets.ts can read a rule without
 * dragging in expo/network deps.
 */
interface State {
  config: AppConfigPayload;
  hydrate: () => Promise<void>;
  setConfig: (server: Partial<AppConfigPayload>) => void;
  /**
   * Drop everything that belongs to the PERSON who just signed out: the per-user flag map,
   * the beta keys and their version — in memory now and in the last-good cache, so the next
   * person on this phone starts from the bundled defaults (no inherited beta UI, not even
   * across a relaunch before the first fetch). Everything else (rules, copy, contact…) is
   * platform-wide and stays.
   */
  resetUserFlags: () => void;
}

/** The per-user part of the payload, at its bundled value. */
const USER_FLAG_DEFAULTS: Pick<AppConfigPayload, 'feature_flags' | 'feature_beta' | 'feature_flags_version'> = {
  feature_flags: {},
  feature_beta: [],
  feature_flags_version: undefined,
};

/** Overlay a (partial) server payload on the bundled defaults — never drop a default. */
export function mergeConfig(server: Partial<AppConfigPayload>): AppConfigPayload {
  return {
    schema_version: server.schema_version ?? CONFIG_DEFAULTS.schema_version,
    min_supported_app_version: server.min_supported_app_version ?? CONFIG_DEFAULTS.min_supported_app_version,
    app_retired: server.app_retired ?? false,
    migration: server.migration ?? null,
    feature_flags: { ...(server.feature_flags ?? {}) },
    // Both optional on the wire: today's server sends neither, and the app must behave
    // exactly as before (no chip anywhere, every flag read unchanged).
    feature_beta: Array.isArray(server.feature_beta) ? server.feature_beta.filter((k): k is string => typeof k === 'string') : [],
    feature_flags_version: typeof server.feature_flags_version === 'string' ? server.feature_flags_version : undefined,
    rules: { ...CONFIG_DEFAULTS.rules, ...(server.rules ?? {}) },
    copy: { ...(server.copy ?? {}) },
    pricing: { ...CONFIG_DEFAULTS.pricing, ...(server.pricing ?? {}) },
    contact: { ...CONFIG_DEFAULTS.contact, ...(server.contact ?? {}) },
    // The backend-code manifest (hidden surfaces, gates, popups, slots, theme…). It was
    // dropped here before — every setConfig() left `config.ui` undefined, so nothing the
    // server hid ever left a screen (found in the 2026-10-15 flag-leak audit). Each section
    // falls back to its bundled default, so a partial manifest never loses the validators.
    ui: { ...CONFIG_DEFAULTS.ui!, ...(server.ui ?? {}) },
    abilities: server.abilities ?? CONFIG_DEFAULTS.abilities,
    // A null side from the server keeps the bundled link: a blocked user must always
    // have somewhere to go.
    store: {
      ios_url: server.store?.ios_url || CONFIG_DEFAULTS.store.ios_url,
      android_url: server.store?.android_url || CONFIG_DEFAULTS.store.android_url,
    },
  };
}

function storage(): { getItem: (k: string) => Promise<string | null>; setItem: (k: string, v: string) => Promise<void> } | null {
  try {
    // Lazy require so this leaf module never pulls AsyncStorage into pure consumers.
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
}

export const useAppConfigStore = create<State>((set, get) => ({
  config: CONFIG_DEFAULTS,
  hydrate: async () => {
    try {
      const raw = await storage()?.getItem(CACHE_KEY);
      if (raw) set({ config: mergeConfig(JSON.parse(raw)) });
    } catch {
      // No cache / bad JSON — stay on bundled defaults.
    }
  },
  setConfig: (server) => {
    set({ config: mergeConfig(server) });
    storage()?.setItem(CACHE_KEY, JSON.stringify(server)).catch(() => {});
  },
  resetUserFlags: () => {
    const stripped = { ...get().config, ...USER_FLAG_DEFAULTS };
    set({ config: stripped });
    storage()?.setItem(CACHE_KEY, JSON.stringify(stripped)).catch(() => {});
  },
}));

/** Non-React accessor for a single rule (e.g. offline batching in src/db). */
export function configRule<K extends keyof AppConfigRules>(key: K): AppConfigRules[K] {
  return useAppConfigStore.getState().config.rules[key] ?? CONFIG_DEFAULTS.rules[key];
}

/** A single contact/payment value — server override ← bundled default. */
export function configContact<K extends keyof AppConfigPayload['contact']>(key: K): AppConfigPayload['contact'][K] {
  return useAppConfigStore.getState().config.contact?.[key] ?? CONFIG_DEFAULTS.contact[key];
}

/** Non-React: is this feature on for the current user only through beta targeting? */
export function isBetaFeature(key: string): boolean {
  return (useAppConfigStore.getState().config.feature_beta ?? []).includes(key);
}
