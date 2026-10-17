import { useAppConfigStore } from '@/stores/appConfigStore';
import { useFeatureTermsStore } from '@/stores/featureTermsStore';

/**
 * For a feature's entry points (a tab, a row, a button): is its add-on agreement still due for
 * this person, and `guard(go)` — run `go` when it is not, otherwise open the agreement instead.
 * The server refuses the feature (423) until it is accepted either way; this just saves the
 * person a screen that would only say so.
 */
export function useFeatureTerms(key: string): { due: boolean; guard: (go: () => void) => void } {
  const due = useAppConfigStore((s) => (s.config.feature_terms ?? []).some((d) => d.key === key));
  return {
    due,
    guard: (go) => {
      if (useAppConfigStore.getState().config.feature_terms?.some((d) => d.key === key)) {
        useFeatureTermsStore.getState().open(key);
        return;
      }
      go();
    },
  };
}
