import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The ticket reply box pads itself by the keyboard's height instead of trusting the
 * KeyboardAvoidingView (founder 2026-11-01/02, three times, iPhone and Android alike: on a long
 * ticket the keys covered the box and «I cannot see what I'm typing»). The view measured itself
 * and animated the change; the keyboard's own height needs neither, so it cannot come out short.
 * Android 11+ is edge-to-edge (SDK 54: the window never shrinks for the keys). Older Androids
 * still shrink the window, so they keep the KeyboardAvoidingView.
 */
export const COMPOSER_PADS_ITSELF = Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) >= 30);

/**
 * The space under a composer pinned to the bottom of a full-height screen. With the keyboard
 * down: the home-indicator / navigation-bar inset. With it up: the keyboard's height, which on
 * iOS already runs to the bottom of the screen; on Android RN reports it without the navigation
 * bar the keys sit on, so that is added back.
 */
export function useComposerBottomInset(): number {
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState<number | null>(null);

  useEffect(() => {
    if (!COMPOSER_PADS_ITSELF) return;
    // iOS announces the keyboard before it moves, so the box rises with it.
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKeyboard(e.endCoordinates.height));
    // A different keyboard (Arabic ↔ English, emoji, suggestions bar) changes the height.
    const change = ios ? Keyboard.addListener('keyboardWillChangeFrame', (e) => setKeyboard((k) => (k === null ? k : e.endCoordinates.height))) : null;
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(null));
    return () => {
      show.remove();
      change?.remove();
      hide.remove();
    };
  }, []);

  if (keyboard === null) return insets.bottom;
  return Platform.OS === 'ios' ? keyboard : keyboard + insets.bottom;
}
