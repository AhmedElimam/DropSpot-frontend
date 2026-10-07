import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTourStore } from './store';

/**
 * Spread onto a screen's ScrollView that holds tour targets. While the screen is in focus the
 * tour can scroll it, so a step whose target is scrolled away is brought back into view
 * instead of skipped (founder 2026-10-07).
 */
export function useTourScroll() {
  const ref = useRef<ScrollView>(null);
  const y = useRef(0);

  useFocusEffect(useCallback(() => {
    const owner = {};
    const { setScroller, clearScroller } = useTourStore.getState();
    setScroller(owner, { scrollBy: (dy) => ref.current?.scrollTo({ y: Math.max(0, y.current + dy), animated: true }) });
    return () => clearScroller(owner);
  }, []));

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => { y.current = e.nativeEvent.contentOffset.y; }, []);

  return { ref, onScroll, scrollEventThrottle: 32 } as const;
}
