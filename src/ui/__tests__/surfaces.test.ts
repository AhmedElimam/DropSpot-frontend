import { useAppConfigStore } from '@/stores/appConfigStore';
import { CONFIG_DEFAULTS } from '@/config/defaults';
import { isSurfaceOn } from '../surfaces';
import { isArabicName, isEgyptPhone, isTripleName, validationMessage } from '@/utils/validators';

const ui = (patch: Partial<NonNullable<typeof CONFIG_DEFAULTS.ui>>) =>
  useAppConfigStore.setState({ config: { ...CONFIG_DEFAULTS, ui: { ...CONFIG_DEFAULTS.ui!, ...patch } } });

afterEach(() => useAppConfigStore.setState({ config: CONFIG_DEFAULTS }));

describe('surfaces obey the backend manifest', () => {
  it('everything is on by default, and off exactly when the backend code lists it', () => {
    expect(isSurfaceOn('teacher.home.rose_card')).toBe(true);
    ui({ hidden: ['teacher.home.rose_card', 'tab.teacher.manage'] });
    expect(isSurfaceOn('teacher.home.rose_card')).toBe(false);
    expect(isSurfaceOn('tab.teacher.manage')).toBe(false);
    expect(isSurfaceOn('teacher.home.stats')).toBe(true);
  });

  it('a manifest without the field (an older server) changes nothing', () => {
    useAppConfigStore.setState({ config: { ...CONFIG_DEFAULTS, ui: undefined } });
    expect(isSurfaceOn('anything')).toBe(true);
    expect(isEgyptPhone('01012345678')).toBe(true);
    expect(isTripleName('أحمد محمد علي')).toBe(true);
  });
});

describe('validators follow the backend rules', () => {
  it('uses the bundled rules until the backend says otherwise', () => {
    expect(isEgyptPhone('01012345678')).toBe(true);
    expect(isEgyptPhone('0101234567')).toBe(false);
    expect(isArabicName('أحمد')).toBe(true);
    expect(isArabicName('Ahmed')).toBe(false);
    expect(isTripleName('أحمد محمد')).toBe(false);
    expect(validationMessage('egypt_phone')).toBeUndefined();
  });

  it('a backend pattern, word count and message take over; a broken pattern is ignored', () => {
    ui({ validation: { egypt_phone: { pattern: '^(01|02)[0-9]{9}$', message: 'رقم مصري من 11 رقمًا' }, triple_name: { min_words: 2 }, arabic_name: { pattern: '[' } } });
    expect(isEgyptPhone('02012345678')).toBe(true);
    expect(validationMessage('egypt_phone')).toBe('رقم مصري من 11 رقمًا');
    expect(isTripleName('أحمد محمد')).toBe(true);
    expect(isArabicName('أحمد')).toBe(true); // bundled regex still applies
    expect(isArabicName('Ahmed')).toBe(false);
  });
});
