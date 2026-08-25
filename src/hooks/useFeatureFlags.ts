import { useAppConfigStore } from '@/stores/appConfigStore';

export type FeatureFlags = Record<string, boolean>;

/**
 * Global feature flags — now folded into the single /app-config payload and read
 * from the config store (the old /feature-flags endpoint is gone). Keeps the
 * `{ data }` shape so existing consumers (`const { data: flags } = ...`) are
 * unchanged; `flags?.[key]` is true only when the super admin enabled it.
 */
export function useFeatureFlags(): { data: FeatureFlags } {
  const data = useAppConfigStore((s) => s.config.feature_flags);
  return { data };
}
