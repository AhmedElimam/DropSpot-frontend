jest.mock('@/api/client', () => ({ __esModule: true, default: {} }));
jest.mock('@/config/env', () => ({ STAGING_HEADER: 'X-Staging-Key', STAGING_KEY: 'k-1' }));
jest.mock('react-native', () => ({ View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'Animated.View' }, FadeInDown: { duration: () => ({ springify: () => ({ damping: () => undefined }) }) } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('@/components/ui/Icon', () => ({ Icon: 'Icon' }));
jest.mock('@/components/chat/AttachmentBubble', () => ({ AttachmentBubble: 'AttachmentBubble' }));
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => 'tok' }));

import { attachmentFileName, attachmentHeaders } from '@/api/chat';
import { tickState } from '../ChatBubble';

describe('attachments carry a name worth keeping (founder 2026-10-12)', () => {
  const at = new Date(2026, 9, 12, 14, 5, 9);
  it('a photo or a voice note gets a stamped name; a document keeps its own', () => {
    expect(attachmentFileName('image', null, 'jpg', at)).toBe('DrosSpot_IMG_20261012_140509.jpg');
    expect(attachmentFileName('image', 'photo.jpg', 'JPG', at)).toBe('DrosSpot_IMG_20261012_140509.jpg');
    expect(attachmentFileName('voice', null, 'm4a', at)).toBe('DrosSpot_VOICE_20261012_140509.m4a');
    expect(attachmentFileName('file', 'واجب الفيزياء.pdf', 'pdf', at)).toBe('واجب الفيزياء.pdf');
    // A cache hash is not a name.
    expect(attachmentFileName('file', '3f2a9c1e8b7d4a6c5e2f1a9b.pdf', 'pdf', at)).toBe('DrosSpot_FILE_20261012_140509.pdf');
  });

  it('a private attachment fetch carries the token and the staging key', async () => {
    const h = await attachmentHeaders();
    expect(h.Authorization).toBe('Bearer tok');
    expect(h['X-Staging-Key']).toBe('k-1');
  });
});

describe('the ticks say what the server can vouch for', () => {
  it('one tick sent, two when someone read it, two lit when everyone has', () => {
    expect(tickState(undefined)).toBe('sent');
    expect(tickState(null)).toBe('sent');
    expect(tickState({ count: 0, all: false })).toBe('sent');
    expect(tickState({ count: 1, all: false })).toBe('seen_some');
    expect(tickState({ count: 3, all: true })).toBe('seen_all');
  });
});
