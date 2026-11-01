import { useCallback, useRef, type RefObject } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';

// How near the end still counts as "reading the latest" (pt).
const NEAR_END = 80;

/**
 * Keeps a conversation on its latest message while the reader is there. Opening the keyboard
 * shrinks the thread from below, and a picture that loads late grows it; neither moved the
 * scroll, so on a long ticket the last messages sat behind the reply box and the keys
 * (founder 2026-11-01: «the overlay happens when the ticket's text is long», a short demo
 * thread fitted). Someone who scrolled up to read stays where they are.
 */
export function useStickToBottom(ref: RefObject<ScrollView | null>) {
  const atEnd = useRef(true);
  const stick = useCallback(() => {
    if (atEnd.current) ref.current?.scrollToEnd({ animated: false });
  }, [ref]);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    atEnd.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_END;
  }, []);

  return { onScroll, scrollEventThrottle: 100, onLayout: stick, onContentSizeChange: stick };
}
