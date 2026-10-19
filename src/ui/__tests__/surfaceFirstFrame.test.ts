import { createElement } from 'react';
import { Text } from 'react-native';
import { NavigationContext } from '@react-navigation/native';

jest.mock('@/stores/authStore', () => ({ useAuthStore: Object.assign((sel: (s: { role: string }) => unknown) => sel({ role: 'teacher' }), { getState: () => ({ role: 'teacher' }) }) }));
jest.mock('@/ui/dialog', () => ({ Alert: { alert: jest.fn() } }));

type Inst = { findAllByType(t: unknown): unknown[] };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer') as { act: (cb: () => void) => void; create: (el: unknown) => { root: Inst } };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Surface, isTabScreen } = require('../surfaces') as typeof import('../surfaces');

/** Render a screen-root Surface inside a navigator of `type`; requestAnimationFrame never fires (fake timers). */
function firstCommit(type: 'tab' | 'stack') {
  const navigation = { getState: () => ({ type }) } as never;
  let tree!: { root: Inst };
  act(() => {
    tree = create(createElement(NavigationContext.Provider, { value: navigation },
      createElement(Surface, { id: 'screen.teacher.sessions', screen: true, children: createElement(Text, null, 'content') })));
  });
  return tree.root.findAllByType(Text).length;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('a screen root\'s first frame', () => {
  it('a tab shows its content in its first commit — no blank page on the switch', () => {
    expect(firstCommit('tab')).toBe(1);
  });

  it('a pushed (stack) screen still slides in light and fills a frame later', () => {
    expect(firstCommit('stack')).toBe(0);
  });

  it('reads the navigator type defensively', () => {
    expect(isTabScreen(undefined)).toBe(false);
    expect(isTabScreen({ getState: () => { throw new Error('no state'); } })).toBe(false);
    expect(isTabScreen({ getState: () => ({ type: 'tab' }) })).toBe(true);
  });
});
