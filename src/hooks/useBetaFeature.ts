import { useAppConfigStore } from '@/stores/appConfigStore';

/**
 * Is this feature on for the current person ONLY because they are beta-targeted
 * (feature-targeting contract 2026-10-15: `feature_beta` in /app-config)? True → the
 * feature's hero carries «تجريبي» (BetaChip / BetaLine). False for an everyone-release,
 * for an off flag, for anonymous, and against a server that does not send the field yet.
 * `useFeatureFlags()` still answers whether the feature is ON at all.
 */
export function useBetaFeature(key: string): boolean {
  return useAppConfigStore((s) => (s.config.feature_beta ?? []).includes(key));
}

// One stable empty list: a selector that minted `[]` per call would re-render every store tick.
const NONE: string[] = [];

/** Every key the current person has through beta targeting (reactive). */
export function useBetaFeatures(): string[] {
  return useAppConfigStore((s) => s.config.feature_beta ?? NONE);
}
