jest.mock('@/stores/authStore', () => ({ useAuthStore: Object.assign((sel: (s: { role: string }) => unknown) => sel({ role: 'teacher' }), { getState: () => ({ role: 'teacher' }) }) }));
jest.mock('@/ui/dialog', () => ({ Alert: { alert: jest.fn() } }));
import { useAppConfigStore } from '@/stores/appConfigStore';
import { CONFIG_DEFAULTS } from '@/config/defaults';
import { isSurfaceOn, setSurfaceContext } from '../surfaces';
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

describe('disabled and conditional surfaces', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resolveSurface } = require('../surfaces') as typeof import('../surfaces');
  const manifest = {
    ...CONFIG_DEFAULTS.ui!,
    hidden: ['teacher.home.whats_new'],
    disabled: { 'teacher.student_profile.terminate_button': 'الإنهاء متوقّف هذا الأسبوع' },
    conditions: {
      'teacher.student_profile.collect_button': { when: 'student.billing.pending_total > 0 && online', else: 'disable' as const, reason: 'لا مستحقات على الطالب' },
      'teacher.home.rose_card': { when: 'role == "teacher" || can.cash_reconcile', else: 'hide' as const },
      'teacher.scan.pay_confirm': { when: 'online && (', else: 'hide' as const }, // malformed: must change nothing
    },
  };

  it('hidden list, static disable with its reason, and conditions that hide or disable by context', () => {
    expect(resolveSurface('teacher.home.whats_new', undefined, manifest, true, 'teacher')).toEqual({ hidden: true, disabled: null });
    expect(resolveSurface('teacher.student_profile.terminate_button', undefined, manifest, true, 'teacher')).toEqual({ hidden: false, disabled: 'الإنهاء متوقّف هذا الأسبوع' });
    const owes = { student: { billing: { pending_total: 300 } } };
    const clear = { student: { billing: { pending_total: 0 } } };
    expect(resolveSurface('teacher.student_profile.collect_button', owes, manifest, true, 'teacher').disabled).toBeNull();
    expect(resolveSurface('teacher.student_profile.collect_button', clear, manifest, true, 'teacher').disabled).toBe('لا مستحقات على الطالب');
    expect(resolveSurface('teacher.student_profile.collect_button', owes, manifest, false, 'teacher').disabled).toBe('لا مستحقات على الطالب');
    setSurfaceContext({ can: {} });
    expect(resolveSurface('teacher.home.rose_card', undefined, manifest, true, 'assistant').hidden).toBe(true);
    setSurfaceContext({ can: { cash_reconcile: true } });
    expect(resolveSurface('teacher.home.rose_card', undefined, manifest, true, 'assistant').hidden).toBe(false);
    expect(resolveSurface('teacher.scan.pay_confirm', undefined, manifest, true, 'teacher')).toEqual({ hidden: false, disabled: null });
    expect(resolveSurface('teacher.anything.else', undefined, manifest, true, 'teacher')).toEqual({ hidden: false, disabled: null });
    expect(resolveSurface('teacher.home.whats_new', undefined, undefined, true, 'teacher')).toEqual({ hidden: false, disabled: null });
  });
});
