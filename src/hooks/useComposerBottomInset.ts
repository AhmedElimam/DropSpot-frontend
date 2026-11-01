import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Android 11+ draws edge-to-edge (SDK 54): the window never shrinks for the keyboard, and the
 * KeyboardAvoidingView's own sums left the ticket reply box behind the keys (founder 2026-11-01,
 * twice). There the composer pads itself by the keyboard's height instead; it comes from the
 * window insets, so it is exact. Older Androids and iOS keep the KeyboardAvoidingView.
 */
export const COMPOSER_PADS_ITSELF = Platform.OS === 'android' && Number(Platform.Version) >= 30;

/**
 * The space under a composer pinned to the bottom of a screen. With the keyboard down: the
 * home-indicator / navigation-bar inset. With it up: nothing on iOS (the keyboard covers that
 * strip, and keeping it left a tall empty "chin", tickets 2026-10-04); on Android 11+ the
 * keyboard's height plus the navigation bar it sits on (RN reports the height without it).
 */
export function useComposerBottomInset(): number {
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios' && !COMPOSER_PADS_ITSELF) return;
    // iOS announces the keyboard before it moves, so the padding changes with it.
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setKeyboard(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(null));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboard === null) return insets.bottom;
  return COMPOSER_PADS_ITSELF ? keyboard + insets.bottom : 0;
}
