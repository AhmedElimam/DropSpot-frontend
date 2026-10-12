jest.mock('@/stores/authStore', () => ({ useAuthStore: Object.assign((sel: (s: { role: string }) => unknown) => sel({ role: 'teacher' }), { getState: () => ({ role: 'teacher' }) }) }));
jest.mock('@/ui/dialog', () => ({ Alert: { alert: jest.fn() } }));
import { useAppConfigStore } from '@/stores/appConfigStore';
import { CONFIG_DEFAULTS } from '@/config/defaults';
import { isSurfaceOn, setSurfaceContext, resolveSurface } from '../surfaces';
import { assistantAllowed } from '../gates';
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

describe('assistant gates: who among the staff sees a control', () => {
  const manifest = (gates: Record<string, string>) => ({ ...CONFIG_DEFAULTS.ui!, gates });

  it('a teacher is never gated; an assistant needs the bundled ability', () => {
    expect(assistantAllowed('x', 'manage_students', manifest({}), { is_assistant: false })).toBe(true);
    expect(assistantAllowed('x', 'manage_students', manifest({}), { is_assistant: true, can: {} })).toBe(false);
    expect(assistantAllowed('x', 'manage_students', manifest({}), { is_assistant: true, can: { manage_students: true } })).toBe(true);
    expect(assistantAllowed('x', 'teacher', manifest({}), { is_assistant: true, can: { manage_students: true } })).toBe(false);
    expect(assistantAllowed('x', undefined, manifest({}), { is_assistant: true, can: {} })).toBe(true);
  });

  it('the server reopens a teacher-only control to assistants by a NEW ability — no app change', () => {
    // Founder 2026-10-12: a new permission had to wait for the next store update.
    const ctx = { is_assistant: true, can: { transfer_students: true } };
    expect(assistantAllowed('teacher.student_profile.transfer_button', 'teacher', manifest({}), ctx)).toBe(false);
    expect(assistantAllowed('teacher.student_profile.transfer_button', 'teacher', manifest({ 'teacher.student_profile.transfer_button': 'transfer_students' }), ctx)).toBe(true);
    expect(assistantAllowed('teacher.manage.row_venues', 'teacher', manifest({ 'teacher.manage.row_venues': 'any' }), { is_assistant: true, can: {} })).toBe(true);
    // …and can close one the app opens by default.
    expect(assistantAllowed('teacher.scan.pay_button', 'scan_attendance', manifest({ 'teacher.scan.pay_button': 'teacher' }), { is_assistant: true, can: { scan_attendance: true } })).toBe(false);
  });

  it('resolveSurface hides a gated surface before anything else, from the global staff context', () => {
    setSurfaceContext({ is_assistant: true, can: { scan_attendance: true } });
    expect(resolveSurface('a', undefined, manifest({}), true, 'assistant', 'teacher').hidden).toBe(true);
    expect(resolveSurface('a', undefined, manifest({}), true, 'assistant', 'scan_attendance').hidden).toBe(false);
    expect(resolveSurface('a', undefined, undefined, true, 'assistant', 'teacher').hidden).toBe(true);
    setSurfaceContext({ is_assistant: false, can: {} });
    expect(resolveSurface('a', undefined, manifest({}), true, 'teacher', 'teacher').hidden).toBe(false);
  });
});

