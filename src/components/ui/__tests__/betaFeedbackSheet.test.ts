/**
 * «رأيك يهمّنا» answered in place (founder 2026-10-19): one tap for how it went, a sentence
 * for a problem or an idea, sent to /feature-feedback, then a thank-you that points to where
 * the reply lands.
 */
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type ReactTestInstance = { type: unknown; props: Record<string, any>; findAll(pred: (n: ReactTestInstance) => boolean): ReactTestInstance[] };
type ReactTestRenderer = { root: ReactTestInstance; unmount(): void };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer') as { act: (cb: () => void | Promise<void>) => Promise<void> | void; create: (el: unknown) => ReactTestRenderer };

const mockPush = jest.fn();
const mockSend = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => `t:${k}` }) }));
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {} }));
jest.mock('@/utils/errors', () => ({ getFriendlyErrorMessage: () => 'friendly' }));
jest.mock('@/api/featureFeedback', () => ({ sendFeatureFeedback: (p: unknown) => mockSend(p) }));
jest.mock('@/components/ui/SheetModal', () => ({
  SheetModal: ({ visible, children }: { visible: boolean; children: unknown }) => (visible ? children : null),
}));
jest.mock('@/components/ui/Button', () => ({
  Button: (p: Record<string, unknown>) => require('react').createElement('button', p),
}));
jest.mock('@/components/ui/Form', () => ({
  Input: (p: Record<string, unknown>) => require('react').createElement('input', p),
}));

import { useAuthStore } from '@/stores/authStore';
import { BetaFeedbackSheet, canSendFeedback, supportHref } from '../BetaFeedbackSheet';

let tree: ReactTestRenderer | null = null;
const clients: QueryClient[] = [];
const onClose = jest.fn();
function mount() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  clients.push(qc);
  act(() => { tree = create(createElement(QueryClientProvider, { client: qc }, createElement(BetaFeedbackSheet, { feature: 'course_chat', visible: true, onClose }))); });
  return tree!;
}
const find = (id: string) => tree!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];
const buttons = () => tree!.root.findAll((n) => n.type === 'button');
const input = () => tree!.root.findAll((n) => n.type === 'input')[0];

beforeEach(() => {
  mockPush.mockReset();
  mockSend.mockReset();
  onClose.mockReset();
  useAuthStore.setState({ role: 'teacher' } as never);
});
afterEach(() => { act(() => { tree?.unmount(); }); tree = null; for (const c of clients.splice(0)) c.clear(); });

describe('canSendFeedback / supportHref', () => {
  it('needs a mood; «works» alone is enough, a problem or an idea needs a sentence', () => {
    expect(canSendFeedback(null, 'anything at all')).toBe(false);
    expect(canSendFeedback('works', '')).toBe(true);
    expect(canSendFeedback('issue', '  مش  ')).toBe(false);
    expect(canSendFeedback('issue', 'الرسائل بتتأخر')).toBe(true);
    expect(canSendFeedback('idea', 'abcd')).toBe(false);
  });

  it('sends each role to its own «مراسلة الإدارة»', () => {
    expect(supportHref('teacher')).toBe('/(teacher)/resolution');
    expect(supportHref('assistant')).toBe('/(teacher)/resolution');
    expect(supportHref('parent')).toBe('/(parent)/support');
    expect(supportHref('student')).toBe('/(student)/support');
  });
});

describe('BetaFeedbackSheet', () => {
  it('asks for the mood first, then the sentence, sends it, and thanks with the way to the reply', async () => {
    mockSend.mockResolvedValue({ id: 9 });
    mount();
    expect(input()).toBeUndefined();
    expect(buttons()[0].props.disabled).toBe(true);

    act(() => { find('beta-mood-issue').props.onPress(); });
    expect(input().props.placeholder).toBe('t:beta.note_issue');
    expect(buttons()[0].props.disabled).toBe(true);
    act(() => { input().props.onChangeText('  الرسائل بتتأخر  '); });
    expect(buttons()[0].props.disabled).toBe(false);

    await act(async () => { buttons()[0].props.onPress(); await new Promise((r) => setTimeout(r, 0)); });
    expect(mockSend).toHaveBeenCalledWith({ feature: 'course_chat', mood: 'issue', message: 'الرسائل بتتأخر' });
    expect(tree!.root.findAll((n) => n.props.testID === 'beta-feedback-sent' && typeof n.type === 'string')).toHaveLength(1);

    // «افتح مراسلة الإدارة»: closes and goes to the teacher's own channel.
    act(() => { buttons()[1].props.onPress(); });
    expect(onClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/(teacher)/resolution');
  });

  it('«works» goes without a sentence, and a refusal is said in the sheet', async () => {
    mockSend.mockRejectedValue(new Error('down'));
    mount();
    act(() => { find('beta-mood-works').props.onPress(); });
    expect(buttons()[0].props.disabled).toBe(false);
    await act(async () => { buttons()[0].props.onPress(); await new Promise((r) => setTimeout(r, 0)); });
    expect(mockSend).toHaveBeenCalledWith({ feature: 'course_chat', mood: 'works', message: undefined });
    expect(tree!.root.findAll((n) => n.props.testID === 'beta-feedback-sent')).toHaveLength(0);
    expect(buttons()).toHaveLength(1);
    expect(tree!.root.findAll((n) => n.props.children === 'friendly').length).toBeGreaterThan(0);
  });
});
