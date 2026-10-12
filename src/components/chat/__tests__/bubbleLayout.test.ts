/**
 * Mine on the right, theirs on the left — on screen, whatever the layout direction; the hold
 * overlay fits on screen; the voice-note playhead never steps back (founder 2026-10-12).
 */
jest.mock('react-native', () => ({ View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable', I18nManager: { isRTL: true }, Platform: { OS: 'ios' }, Vibration: { vibrate: jest.fn() }, useWindowDimensions: () => ({ width: 390, height: 844 }), ActivityIndicator: 'ActivityIndicator' }));
jest.mock('react-native-gesture-handler', () => ({ Gesture: {}, GestureDetector: 'GestureDetector' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'Animated.View' }, FadeInDown: {}, FadeIn: {}, FadeOut: {}, ZoomIn: {} }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('@/components/ui/Icon', () => ({ Icon: 'Icon' }));
jest.mock('@/components/chat/AttachmentBubble', () => ({ AttachmentBubble: 'AttachmentBubble' }));
jest.mock('@/ui/AppModal', () => ({ AppModal: 'AppModal' }));
jest.mock('@/api/client', () => ({ __esModule: true, default: {} }));
jest.mock('@/config/env', () => ({ STAGING_HEADER: 'X-Staging-Key', STAGING_KEY: '' }));
jest.mock('expo-audio', () => ({}));
jest.mock('expo-file-system', () => ({ File: class {}, Paths: {} }));
jest.mock('@/theme/chat', () => ({ chat: {}, waveform: () => [], senderColor: () => '#000' }));
jest.mock('@/components/chat/voiceQueue', () => ({}));

import { bubbleSide, tailCorner } from '../ChatBubble';
import { overlayLayout } from '../MessageActionsOverlay';
import { nextAnchor } from '../VoiceNote';

describe('my messages on the right, others on the left', () => {
  it('under RTL the right edge is flex-start; under LTR it is flex-end', () => {
    expect(bubbleSide(true, true)).toBe('flex-start');
    expect(bubbleSide(false, true)).toBe('flex-end');
    expect(bubbleSide(true, false)).toBe('flex-end');
    expect(bubbleSide(false, false)).toBe('flex-start');
  });
  it('the squared corner is the outer bottom corner: right for mine, left for theirs', () => {
    expect(tailCorner(true, true)).toEqual({ borderBottomStartRadius: 4 });
    expect(tailCorner(false, true)).toEqual({ borderBottomEndRadius: 4 });
    expect(tailCorner(true, false)).toEqual({ borderBottomEndRadius: 4 });
  });
});

describe('the hold overlay fits on screen', () => {
  it('a message mid-screen stays put, the bar above it, the card below', () => {
    const l = overlayLayout({ x: 0, y: 400, width: 200, height: 60 }, 844, 47, 34, 3, true);
    expect(l.top).toBe(400);
    expect(l.barTop).toBe(400 - 62);
    expect(l.cardTop).toBe(468);
  });
  it('a message at the very top moves down for the bar; one at the bottom moves up for the card', () => {
    expect(overlayLayout({ x: 0, y: 20, width: 200, height: 60 }, 844, 47, 34, 3, true).top).toBe(47 + 12 + 62);
    const low = overlayLayout({ x: 0, y: 780, width: 200, height: 60 }, 844, 47, 34, 4, true);
    expect(low.cardTop + 4 * 50 + 12).toBeLessThanOrEqual(844 - 34 - 12);
  });
});

describe('the voice-note playhead never sits back', () => {
  it('holds still until the audio moves, then absorbs small gaps forward-only', () => {
    expect(nextAnchor(0.0, 0.3, 0.3, false)).toBe(0.0);
    expect(nextAnchor(1.0, 1.15, 1.15, true)).toBe(1.15);
    expect(nextAnchor(1.3, 1.15, 1.15, true)).toBe(1.3);
    expect(nextAnchor(8.0, 1.2, 1.2, true)).toBe(8.0);
  });
});
