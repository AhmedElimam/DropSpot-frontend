import { useEffect } from 'react';
import { Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';

/**
 * The keyboard never moves while the screen does. A swipe back with the keyboard up slid the
 * keyboard down while the page slid away — two animations at once, the stutter the founder
 * saw on search (2026-10-10) and again in the chat (2026-10-12). UIKit's will-disappear
 * arrives as `transitionStart { closing: true }` on the very first frame of the gesture; the
 * keyboard goes then, before the page moves.
 */
export function useKeyboardDropOnLeave(): void {
  const navigation = useNavigation();
  useEffect(() => {
    const off = navigation.addListener('transitionStart' as never, (e: { data?: { closing?: boolean } }) => {
      if (e?.data?.closing) Keyboard.dismiss();
    });
    return off;
  }, [navigation]);
}
