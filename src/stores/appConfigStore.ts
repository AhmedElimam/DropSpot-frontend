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
}

/** Overlay a (partial) server payload on the bundled defaults — never drop a default. */
export function mergeConfig(server: Partial<AppConfigPayload>): AppConfigPayload {
  return {
    schema_version: server.schema_version ?? CONFIG_DEFAULTS.schema_version,
    min_supported_app_version: server.min_supported_app_version ?? CONFIG_DEFAULTS.min_supported_app_version,
    feature_flags: { ...(server.feature_flags ?? {}) },
    rules: { ...CONFIG_DEFAULTS.rules, ...(server.rules ?? {}) },
    copy: { ...(server.copy ?? {}) },
    pricing: { ...CONFIG_DEFAULTS.pricing, ...(server.pricing ?? {}) },
    contact: { ...CONFIG_DEFAULTS.contact, ...(server.contact ?? {}) },
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

export const useAppConfigStore = create<State>((set) => ({
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
}));

/** Non-React accessor for a single rule (e.g. offline batching in src/db). */
export function configRule<K extends keyof AppConfigRules>(key: K): AppConfigRules[K] {
  return useAppConfigStore.getState().config.rules[key] ?? CONFIG_DEFAULTS.rules[key];
}

/** A single contact/payment value — server override ← bundled default. */
export function configContact<K extends keyof AppConfigPayload['contact']>(key: K): AppConfigPayload['contact'][K] {
  return useAppConfigStore.getState().config.contact?.[key] ?? CONFIG_DEFAULTS.contact[key];
}
