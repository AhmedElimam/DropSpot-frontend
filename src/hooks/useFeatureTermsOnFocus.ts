import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAppConfigStore } from '@/stores/appConfigStore';
import { useFeatureTermsStore } from '@/stores/featureTermsStore';

/**
 * A feature's own screen (the chat tab, the parent's community, the teacher's conversations):
 * opening it while one of its add-on agreements is still due — put off with «لاحقًا» — brings
 * the agreement back, instead of a screen the server will refuse (423) anyway.
 */
export function useFeatureTermsOnFocus(keys: readonly string[]): void {
  const sig = keys.join(',');
  useFocusEffect(useCallback(() => {
    const due = useAppConfigStore.getState().config.feature_terms ?? [];
    const key = sig.split(',').find((k) => due.some((d) => d.key === k));
    if (key) useFeatureTermsStore.getState().open(key);
  }, [sig]));
}
