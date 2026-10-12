import { Platform, Vibration } from 'react-native';

/**
 * Small taps under the finger — the feel of a messenger's record button.
 *
 * expo-haptics is loaded lazily and optionally: a JS update landing on an older binary that
 * has no native haptics module must not crash, it just goes quiet (or, on Android, uses a
 * short vibration). Plain `Vibration` is NOT a fallback on iOS: it ignores the duration and
 * always buzzes for ~400 ms, which is exactly the heavy, un-smooth feel being replaced.
 */
export type HapticKind = 'tick' | 'light' | 'medium' | 'success' | 'warning';

type HapticsModule = typeof import('expo-haptics');
let mod: HapticsModule | null | undefined;

function haptics(): HapticsModule | null {
  if (mod === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('expo-haptics') as HapticsModule;
    } catch {
      mod = null;
    }
  }
  return mod;
}

export function haptic(kind: HapticKind): void {
  const h = haptics();
  if (!h) {
    if (Platform.OS === 'android') Vibration.vibrate(kind === 'warning' ? 35 : 12);
    return;
  }
  try {
    switch (kind) {
      case 'tick': void h.selectionAsync(); break;
      case 'light': void h.impactAsync(h.ImpactFeedbackStyle.Light); break;
      case 'medium': void h.impactAsync(h.ImpactFeedbackStyle.Medium); break;
      case 'success': void h.notificationAsync(h.NotificationFeedbackType.Success); break;
      case 'warning': void h.notificationAsync(h.NotificationFeedbackType.Warning); break;
    }
  } catch {
    // Haptics are a nicety.
  }
}
