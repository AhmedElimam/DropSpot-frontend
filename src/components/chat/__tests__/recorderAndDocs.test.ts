/**
 * The record button's rules and the document card's words (founder 2026-10-12: «the voice note
 * doesn't work on hold and doesn't swipe to cancel»; «media doesn't display part of it like
 * WhatsApp for PDF and Excel»).
 */
jest.mock('react-native', () => ({ View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', Alert: { alert: jest.fn() }, I18nManager: { isRTL: true }, Platform: { OS: 'ios' }, Vibration: { vibrate: jest.fn() }, StyleSheet: { absoluteFillObject: {} } }));
jest.mock('react-native-gesture-handler', () => ({ Gesture: {}, GestureDetector: 'GestureDetector' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'Animated.View' } }));
jest.mock('expo-audio', () => ({ RecordingPresets: { HIGH_QUALITY: {} } }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('@/components/ui/Icon', () => ({ Icon: 'Icon' }));
jest.mock('@/api/client', () => ({ __esModule: true, default: {} }));
jest.mock('@/config/env', () => ({ STAGING_HEADER: 'X-Staging-Key', STAGING_KEY: '' }));
jest.mock('@/utils/format', () => ({ formatNumber: (n: number) => String(n) }));

import { CANCEL_DX, LOCK_DY, levelFromDb, slideIntent } from '../VoiceRecorder';
import { docCountLabel, docType, fileSizeLabel } from '../DocumentCard';

describe('the record button reads the finger like WhatsApp', () => {
  it('a small wobble does nothing', () => {
    expect(slideIntent(12, 8)).toEqual({ slide: 12, lift: 0, action: 'none' });
    expect(slideIntent(-30, -10)).toEqual({ slide: 0, lift: 0, action: 'none' });
  });
  it('sliding toward the bar past the line cancels at once', () => {
    expect(slideIntent(CANCEL_DX + 1, 20).action).toBe('cancel');
    expect(slideIntent(CANCEL_DX - 1, 20).action).toBe('none');
  });
  it('sliding up past the line locks; whichever axis leads wins', () => {
    expect(slideIntent(10, LOCK_DY + 1).action).toBe('lock');
    // Mostly up, a little sideways: it is a lift, never half a cancel.
    expect(slideIntent(60, 70)).toEqual({ slide: 0, lift: 70, action: 'none' });
    // Mostly sideways: the lift is ignored.
    expect(slideIntent(100, 90)).toEqual({ slide: 100, lift: 0, action: 'none' });
  });
  it('the level follows the voice and never vanishes', () => {
    expect(levelFromDb(undefined)).toBeCloseTo(0.1);
    expect(levelFromDb(-160)).toBeCloseTo(0.1);
    expect(levelFromDb(-8)).toBe(1);
    expect(levelFromDb(-30)).toBeCloseTo(0.5, 1);
  });
});

describe('a document says what it is before it is opened', () => {
  it('the badge is the format a person recognises', () => {
    expect(docType('ورقة.pdf', 'application/pdf')).toEqual({ label: 'PDF', color: '#D93025' });
    expect(docType('درجات.xlsx', null).label).toBe('XLSX');
    expect(docType('x', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').label).toBe('DOCX');
    expect(docType('شرح.pptx', null).label).toBe('PPTX');
    expect(docType('a.csv', 'text/csv').label).toBe('CSV');
    expect(docType('weird.bin', null).label).toBe('BIN');
  });
  it('sizes read as a person says them', () => {
    expect(fileSizeLabel(null)).toBe('');
    expect(fileSizeLabel(300)).toBe('1 ك.ب');
    expect(fileSizeLabel(240 * 1024)).toBe('240 ك.ب');
    expect(fileSizeLabel(1.44 * 1024 * 1024)).toBe('1.4 م.ب');
  });
  it('counts are said in Arabic: one, two, a few, many', () => {
    expect(docCountLabel({ pages: 1 })).toBe('صفحة واحدة');
    expect(docCountLabel({ pages: 2 })).toBe('صفحتان');
    expect(docCountLabel({ pages: 7 })).toBe('7 صفحات');
    expect(docCountLabel({ pages: 24 })).toBe('24 صفحة');
    expect(docCountLabel({ slides: 3 })).toBe('3 شرائح');
    expect(docCountLabel({ sheets: 1 })).toBe('');
    expect(docCountLabel({ sheets: 2 })).toBe('ورقتان');
    expect(docCountLabel(null)).toBe('');
  });
});
