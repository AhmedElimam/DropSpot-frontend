import { createElement } from 'react';

// react-test-renderer ships without type declarations here; this is the shape the test uses.
type ReactTestInstance = { type: unknown; props: Record<string, any>; parent: ReactTestInstance | null; findAll(pred: (n: ReactTestInstance) => boolean): ReactTestInstance[]; findAllByType(type: unknown): ReactTestInstance[] };
type ReactTestRenderer = { root: ReactTestInstance };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer') as { act: (cb: () => void) => void; create: (el: unknown) => ReactTestRenderer };
import { NotchTabBar, BUTTON } from '../NotchTabBar';

jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => `t:${k}` }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }) }));

const TABS = ['index', 'teachers', 'children', 'invoices', 'profile'] as const;
const labels: Record<string, string> = { index: 'nav.home', teachers: 'parent.teachers', children: 'nav.children', invoices: 'nav.invoices', profile: 'nav.settings' };
const icons = { index: 'home', teachers: 'teacher', children: 'children', invoices: 'invoices', profile: 'settings' } as const;

function mount(focused = 'index') {
  // Every registered route, hidden detail screens included, as the navigator passes them.
  const names = ['index', 'children', 'teachers', 'invoices', 'tickets', 'profile', 'reports', 'child/[id]'];
  const routes = names.map((name) => ({ key: `${name}-key`, name, params: undefined }));
  const state = { index: names.indexOf(focused), routes, key: 'tab', routeNames: names, type: 'tab', stale: false, history: [] };
  const emit = jest.fn(() => ({ defaultPrevented: false }));
  const navigate = jest.fn();
  const navigation = { emit, navigate } as any;
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(createElement(NotchTabBar as unknown as (props: Record<string, unknown>) => null, { state, descriptors: {}, navigation, insets: { top: 0, bottom: 20, left: 0, right: 0 }, tabs: TABS, center: 'children', labels, icons }));
  });
  return { tree, emit, navigate };
}

// Outermost element of each tab (the pressable passes its a11y props down to host views).
const tabsOf = (tree: ReactTestRenderer): ReactTestInstance[] =>
  tree.root.findAll((n: ReactTestInstance) => n.props.accessibilityRole === 'tab').filter((n: ReactTestInstance) => n.parent?.props.accessibilityRole !== 'tab');

describe('NotchTabBar', () => {
  it('draws exactly the given tabs, in order, and none of the hidden routes', () => {
    const { tree } = mount();
    const tabs = tabsOf(tree);
    expect(tabs.map((n: ReactTestInstance) => n.props.accessibilityLabel)).toEqual(TABS.map((n) => `t:${labels[n]}`));
    expect(tree.root.findAll((n: ReactTestInstance) => n.props.accessibilityLabel === 't:nav.tickets')).toHaveLength(0);
  });

  it('marks the focused tab selected and lifts the centre one into a round button', () => {
    const { tree } = mount('children');
    const tabs = tabsOf(tree);
    expect(tabs.map((n: ReactTestInstance) => n.props.accessibilityState.selected)).toEqual([false, false, true, false, false]);
    const round = tree.root.findAll((n: ReactTestInstance) => typeof n.type === 'string' && n.props.style && [n.props.style].flat().some((s: any) => s && s.borderRadius === BUTTON / 2 && s.width === BUTTON));
    expect(round).toHaveLength(1);
  });

  it('navigates on press, but not to the tab already open, and lets a listener prevent it', () => {
    const { tree, emit, navigate } = mount('index');
    const tabs = tabsOf(tree);
    act(() => { tabs[2].props.onPress(); });
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tabPress', target: 'children-key' }));
    expect(navigate).toHaveBeenCalledWith('children', undefined);

    navigate.mockClear();
    act(() => { tabs[0].props.onPress(); });
    expect(navigate).not.toHaveBeenCalled();

    emit.mockReturnValueOnce({ defaultPrevented: true } as any);
    act(() => { tabs[3].props.onPress(); });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('puts a custom glyph in the centre button when given one', () => {
    const names = ['index', 'children'];
    const routes = names.map((name) => ({ key: `${name}-key`, name, params: undefined }));
    const state = { index: 0, routes, key: 'tab', routeNames: names, type: 'tab', stale: false, history: [] };
    const glyph = jest.fn((color: string) => createElement('BrandGlyph', { color }));
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(createElement(NotchTabBar as unknown as (props: Record<string, unknown>) => null, { state, descriptors: {}, navigation: { emit: jest.fn(() => ({})), navigate: jest.fn() }, insets: { top: 0, bottom: 0, left: 0, right: 0 }, tabs: TABS, center: 'children', labels, icons, centerGlyph: glyph }));
    });
    expect(tree.root.findAllByType('BrandGlyph' as any)).toHaveLength(1);
    expect(glyph).toHaveBeenCalledWith(expect.any(String), false);
  });

  it('leaves an empty slot for a tab the navigator does not know, instead of crashing', () => {
    const names = ['index', 'children'];
    const routes = names.map((name) => ({ key: `${name}-key`, name, params: undefined }));
    const state = { index: 0, routes, key: 'tab', routeNames: names, type: 'tab', stale: false, history: [] };
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(createElement(NotchTabBar as unknown as (props: Record<string, unknown>) => null, { state, descriptors: {}, navigation: { emit: jest.fn(() => ({})), navigate: jest.fn() }, insets: { top: 0, bottom: 0, left: 0, right: 0 }, tabs: TABS, center: 'children', labels, icons }));
    });
    expect(tabsOf(tree)).toHaveLength(2);
  });
});
