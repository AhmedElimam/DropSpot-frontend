const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: mockPush } }));
const mockOpen = jest.fn(async () => true);
jest.mock('react-native', () => ({ Linking: { openURL: mockOpen } }));
const mockAlert = jest.fn();
const mockSetPersona = jest.fn();
jest.mock('@/ui/dialog', () => ({ Alert: { alert: mockAlert }, useDialogStore: { getState: () => ({ persona: 'brand', setPersona: mockSetPersona }) } }));

import { useAppConfigStore } from '@/stores/appConfigStore';
import { CONFIG_DEFAULTS } from '@/config/defaults';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handleServerMeta, resolvePopup, runPopupAction, showServerPopup } = require('../serverPopup') as typeof import('../serverPopup');

beforeEach(() => {
  jest.clearAllMocks();
  useAppConfigStore.setState({ config: { ...CONFIG_DEFAULTS, ui: { ...CONFIG_DEFAULTS.ui!, popups: { done: { title: 'تم', body: 'وصل', buttons: [{ label: 'تمام', action: 'dismiss' }, { label: 'افتح', action: 'navigate:/(teacher)/students' }] } } } } });
});

describe('server popups', () => {
  it('resolves a named popup from the manifest, or an inline spec, and refuses junk', () => {
    expect(resolvePopup('done')?.title).toBe('تم');
    expect(resolvePopup({ id: 'done' })?.buttons).toHaveLength(2);
    expect(resolvePopup({ title: 'أهلًا' })?.buttons).toEqual([{ label: 'حسنًا', action: 'dismiss' }]);
    expect(resolvePopup('nope')).toBeNull();
    expect(resolvePopup({ body: 'no title' })).toBeNull();
    expect(resolvePopup(42)).toBeNull();
  });

  it('shows the popup through the branded dialog and runs the button actions', () => {
    expect(showServerPopup('done')).toBe(true);
    expect(mockAlert).toHaveBeenCalledWith('تم', 'وصل', expect.any(Array));
    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress: () => void }[];
    expect(buttons.map((b) => b.text)).toEqual(['تمام', 'افتح']);
    buttons[1].onPress();
    expect(mockPush).toHaveBeenCalledWith('/(teacher)/students');
    runPopupAction('url:https://drosspot.app/help');
    expect(mockOpen).toHaveBeenCalledWith('https://drosspot.app/help');
    runPopupAction('url:http://insecure');
    runPopupAction('javascript:alert(1)');
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it('wears مدام روز for her popups and hands the persona back', () => {
    showServerPopup({ title: 'يا أستاذ', persona: 'rose' });
    expect(mockSetPersona.mock.calls.map((c) => c[0])).toEqual(['rose', 'brand']);
  });

  it('acts on a response meta: popup and navigation, nothing else', () => {
    handleServerMeta({ popup: { id: 'done' }, navigate: '/(teacher)/collect' });
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/(teacher)/collect');
    handleServerMeta({ navigate: 'https://evil' });
    handleServerMeta(null);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
