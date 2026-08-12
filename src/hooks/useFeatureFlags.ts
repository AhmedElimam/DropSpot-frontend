import { useQuery } from '@tanstack/react-query';
import { getFeatureFlags, type FeatureFlags } from '@/api/featureFlags';

/** Cached global feature flags. `flags?.[key]` is true only when the super admin enabled it. */
export function useFeatureFlags() {
  return useQuery<FeatureFlags>({
    queryKey: ['feature-flags'],
    queryFn: getFeatureFlags,
    staleTime: 5 * 60_000,
  });
}
