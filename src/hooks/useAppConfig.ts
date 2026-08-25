import { useAppConfigStore } from '@/stores/appConfigStore';
import type { AppConfigRules } from '@/config/defaults';

/** The full resolved config (defaults ← cache ← server). */
export function useAppConfig() {
  return useAppConfigStore((s) => s.config);
}

/** One rule value, reactive — falls back to the bundled default automatically. */
export function useConfigRule<K extends keyof AppConfigRules>(key: K): AppConfigRules[K] {
  return useAppConfigStore((s) => s.config.rules[key]);
}
