/**
 * «تجريبي» marks (feature-targeting contract 2026-10-15): drawn only for a key the person
 * holds through beta targeting; the line opens the tickets screen for staff and is a bare
 * chip for a student or a parent.
 */
import { createElement } from 'react';
import { CONFIG_DEFAULTS } from '@/config/defaults';

type ReactTestInstance = { type: unknown; props: Record<string, any>; findAll(pred: (n: ReactTestInstance) => boolean): ReactTestInstance[] };
type ReactTestRenderer = { root: ReactTestInstance; toJSON(): unknown; unmount(): void };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer') as { act: (cb: () => void) => void; create: (el: unknown) => ReactTestRenderer };

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => `t:${k}` }) }));
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {} }));

import { useAppConfigStore } from '@/stores/appConfigStore';
import { useAuthStore } from '@/stores/authStore';
import { useBetaFeature, useBetaFeatures } from '@/hooks/useBetaFeature';
import { BetaChip, BetaLine, BETA_FEEDBACK_ROUTE } from '../Beta';

const setBeta = (keys: string[]) => useAppConfigStore.setState({ config: { ...CONFIG_DEFAULTS, feature_flags: Object.fromEntries(keys.map((k) => [k, true])), feature_beta: keys } });
const setRole = (role: 'teacher' | 'assistant' | 'student' | 'parent') =>
  useAuthStore.setState({ user: { id: 1, user_type_id: role === 'teacher' ? 3 : role === 'assistant' ? 6 : role === 'student' ? 5 : 4 } as never, role, isAuthenticated: true, isLoading: false });

const mounted: ReactTestRenderer[] = [];
function mount(el: unknown): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = create(el); });
  mounted.push(tree);
  return tree;
}
// Host nodes only: a testID is also on the composite View/TouchableOpacity above the host.
const byTestId = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
/** The node that owns the press handler (the composite TouchableOpacity, not its host view). */
const pressable = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];
const textsOf = (tree: ReactTestRenderer): string[] =>
  tree.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);

beforeEach(() => {
  mockPush.mockReset();
  act(() => {
    useAppConfigStore.setState({ config: CONFIG_DEFAULTS });
    setRole('teacher');
  });
});
afterEach(() => {
  // Trees left mounted would re-render on the next test's store resets, outside act().
  act(() => { for (const t of mounted.splice(0)) t.unmount(); });
});

describe('useBetaFeature', () => {
  function Probe({ feature }: { feature: string }) {
    const beta = useBetaFeature(feature);
    const all = useBetaFeatures();
    return createElement('probe', { beta, all });
  }

  it('is false against a server that sends no feature_beta, and for a released key', () => {
    useAppConfigStore.setState({ config: { ...CONFIG_DEFAULTS, feature_flags: { chat: true }, feature_beta: undefined } });
    const tree = mount(createElement(Probe, { feature: 'chat' }));
    const probe = tree.root.findAll((n) => n.type === 'probe')[0];
    expect(probe.props.beta).toBe(false);
    expect(probe.props.all).toEqual([]);
  });

  it('is true only for a key in feature_beta, and follows the store', () => {
    setBeta(['chat']);
    const tree = mount(createElement(Probe, { feature: 'chat' }));
    expect(tree.root.findAll((n) => n.type === 'probe')[0].props.beta).toBe(true);
    act(() => { useAppConfigStore.getState().resetUserFlags(); });
    expect(tree.root.findAll((n) => n.type === 'probe')[0].props.beta).toBe(false);
  });
});

describe('BetaChip', () => {
  it('renders nothing for a feature the person does not hold through beta', () => {
    const tree = mount(createElement(BetaChip, { feature: 'chat' }));
    expect(byTestId(tree, 'beta-chip')).toHaveLength(0);
  });

  it('renders the gold «تجريبي» for a beta key, and always when ungated', () => {
    setBeta(['chat']);
    expect(byTestId(mount(createElement(BetaChip, { feature: 'chat' })), 'beta-chip')).toHaveLength(1);
    expect(textsOf(mount(createElement(BetaChip, {})))).toContain('t:beta.chip');
  });

  it('disappears when the flag is reset on sign-out', () => {
    setBeta(['chat']);
    const tree = mount(createElement(BetaChip, { feature: 'chat' }));
    expect(byTestId(tree, 'beta-chip')).toHaveLength(1);
    act(() => { useAppConfigStore.getState().resetUserFlags(); });
    expect(byTestId(tree, 'beta-chip')).toHaveLength(0);
  });
});

describe('BetaLine', () => {
  it('renders nothing unless the key is in feature_beta', () => {
    expect(byTestId(mount(createElement(BetaLine, { feature: 'private_courses' })), 'beta-line')).toHaveLength(0);
  });

  it.each(['teacher', 'assistant'] as const)('for a %s: the line, tappable, opening the tickets screen', (role) => {
    setRole(role);
    setBeta(['private_courses']);
    const tree = mount(createElement(BetaLine, { feature: 'private_courses' }));
    expect(byTestId(tree, 'beta-line')).toHaveLength(1);
    expect(textsOf(tree)).toEqual(expect.arrayContaining(['t:beta.line', 't:beta.chip']));
    act(() => { pressable(tree, 'beta-line').props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith(BETA_FEEDBACK_ROUTE);
    expect(BETA_FEEDBACK_ROUTE).toBe('/(teacher)/tickets');
  });

  it.each(['student', 'parent'] as const)('for a %s: the chip only — no line, nothing to tap', (role) => {
    setRole(role);
    setBeta(['chat']);
    const tree = mount(createElement(BetaLine, { feature: 'chat' }));
    expect(byTestId(tree, 'beta-line')).toHaveLength(1);
    expect(tree.root.findAll((n) => n.props.testID === 'beta-line' && typeof n.props.onPress === 'function')).toHaveLength(0);
    expect(byTestId(tree, 'beta-chip')).toHaveLength(1);
    expect(textsOf(tree)).not.toContain('t:beta.line');
  });
});
