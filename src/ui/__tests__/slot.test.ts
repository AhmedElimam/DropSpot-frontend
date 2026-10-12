jest.mock('@/stores/authStore', () => ({ useAuthStore: Object.assign((sel: (s: { role: string }) => unknown) => sel({ role: 'teacher' }), { getState: () => ({ role: 'teacher' }) }) }));
const mockAlert = jest.fn();
// Lazy wrappers: `../surfaces` is hoisted above these consts and pulls the dialog in first.
jest.mock('@/ui/dialog', () => ({ Alert: { alert: (...a: unknown[]) => mockAlert(...a) }, useDialogStore: { getState: () => ({ persona: 'brand', setPersona: jest.fn() }) } }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
const mockRequest = jest.fn();
jest.mock('@/api/client', () => ({ __esModule: true, default: { request: (...a: unknown[]) => mockRequest(...a) } }));
const mockInvalidate = jest.fn();
jest.mock('@/lib/queryClientRef', () => ({ getQueryClient: () => ({ invalidateQueries: (...a: unknown[]) => mockInvalidate(...a) }) }));
jest.mock('@/components/ui/Icon', () => ({ Icon: 'Icon' }));

import { setSurfaceContext } from '../surfaces';
import type { UiBlock } from '@/config/defaults';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveSlot, fillBody } = require('../Slot') as typeof import('../Slot');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runApiAction, runPopupAction } = require('../serverPopup') as typeof import('../serverPopup');

const blocks: UiBlock[] = [
  { type: 'notice', tone: 'warning', body: 'صيانة', id: 'maintenance' },
  { type: 'card', title: 'الدرج', when: "role == 'teacher' || can.cash_reconcile", buttons: [{ label: 'افتح', action: 'navigate:/(teacher)/cash-reconcile' }] },
  { type: 'button', when: 'student.billing.pending_total > 0', buttons: [{ label: 'ذكّر', action: 'api:post /teacher/reminder' }] },
  { type: 'banner' as never, body: 'junk' },
];

beforeEach(() => { jest.clearAllMocks(); setSurfaceContext({ can: {} }); });

describe('slots: UI the backend adds', () => {
  it('shows nothing until backend code puts a block there, then every sound block', () => {
    expect(resolveSlot('teacher.home.top', undefined, undefined, true, 'teacher')).toEqual([]);
    expect(resolveSlot('teacher.home.top', undefined, { slots: {} }, true, 'teacher')).toEqual([]);
    const shown = resolveSlot('teacher.home.top', { student: { billing: { pending_total: 120 } } }, { slots: { 'teacher.home.top': blocks } }, true, 'teacher');
    expect(shown.map((b) => b.type)).toEqual(['notice', 'card', 'button']);
  });

  it('a block obeys its condition against what the app and the screen know', () => {
    const ui = { slots: { 'teacher.home.top': blocks } };
    expect(resolveSlot('teacher.home.top', { student: { billing: { pending_total: 0 } } }, ui, true, 'assistant').map((b) => b.type)).toEqual(['notice']);
    setSurfaceContext({ can: { cash_reconcile: true } });
    expect(resolveSlot('teacher.home.top', undefined, ui, true, 'assistant').map((b) => b.type)).toEqual(['notice', 'card']);
  });

  it('a block past its expires_at is dropped on the phone, even from a cached manifest', () => {
    const ui = { slots: { 'teacher.home.top': [{ type: 'notice' as const, body: 'الليلة', expires_at: '2026-10-13T01:00:00+03:00' }, { type: 'notice' as const, body: 'دائم' }] } };
    expect(resolveSlot('teacher.home.top', undefined, ui, true, 'teacher', Date.parse('2026-10-12T20:00:00+03:00')).map((b) => b.body)).toEqual(['الليلة', 'دائم']);
    expect(resolveSlot('teacher.home.top', undefined, ui, true, 'teacher', Date.parse('2026-10-13T02:00:00+03:00')).map((b) => b.body)).toEqual(['دائم']);
  });

  it('a body placeholder is filled from the screen, never guessed', () => {
    const btn = { label: 'ذكّر', action: 'api:post /teacher/students/dues-reminder', body: { student_id: '{student.id}', days: 3, note: '{student.nope}', literal: '{not a name}' } };
    expect(fillBody(btn, { student: { id: 42 } }).body).toEqual({ student_id: 42, days: 3, literal: '{not a name}' });
    expect(fillBody({ label: 'x', action: 'dismiss' }, {}).body).toBeUndefined();
  });

  it('hidden switches off a whole slot, or one block by its id', () => {
    const ui = { slots: { 'teacher.home.top': blocks } };
    expect(resolveSlot('teacher.home.top', undefined, { ...ui, hidden: ['teacher.home.top'] }, true, 'teacher')).toEqual([]);
    expect(resolveSlot('teacher.home.top', undefined, { ...ui, hidden: ['teacher.home.top#maintenance'] }, true, 'teacher').map((b) => b.type)).toEqual(['card']);
  });
});

describe('api: buttons call the backend through the app client', () => {
  it('posts the body, shows the answer message and refreshes every screen', async () => {
    mockRequest.mockResolvedValueOnce({ data: { message: 'أُرسل التذكير' } });
    expect(await runApiAction('api:post /teacher/reminders/dues', { body: { days: 3 } })).toBe(true);
    expect(mockRequest).toHaveBeenCalledWith({ method: 'post', url: '/teacher/reminders/dues', data: { days: 3 } });
    expect(mockAlert).toHaveBeenCalledWith('أُرسل التذكير');
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it('asks first when the button says so, and a refusal calls nothing', async () => {
    mockAlert.mockImplementationOnce((_t: string, _b: unknown, buttons: { text: string; onPress: () => void }[]) => buttons[0].onPress());
    expect(await runApiAction('api:post /teacher/x', { confirm: 'متأكد؟' })).toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();
    mockAlert.mockImplementationOnce((_t: string, _b: unknown, buttons: { text: string; onPress: () => void }[]) => buttons[1].onPress());
    mockRequest.mockResolvedValueOnce({ data: {} });
    expect(await runApiAction('api:post /teacher/x', { confirm: 'متأكد؟' })).toBe(true);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('a server refusal shows its words; a malformed action does nothing at all', async () => {
    mockRequest.mockRejectedValueOnce({ response: { status: 422, data: { message: 'لا مستحقات' } } });
    expect(await runApiAction('api:post /teacher/x')).toBe(false);
    expect(mockAlert).toHaveBeenCalled();
    expect(await runApiAction('api:post javascript:alert(1)')).toBe(false);
    expect(await runApiAction('api:trace /x')).toBe(false);
    runPopupAction('api:post /nope');
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
});
