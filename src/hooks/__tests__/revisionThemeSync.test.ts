import { createElement } from 'react';

// react-test-renderer ships without type declarations here; this is the shape the test uses.
type ReactTestRenderer = { unmount(): void; update(el: unknown): void };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer') as { act: (cb: () => void) => void; create: (el: unknown) => ReactTestRenderer };

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) },
}));
let mockPathname = '/';
jest.mock('expo-router', () => ({ usePathname: () => mockPathname }));
let mockReviseOn: boolean | undefined = true;
jest.mock('@/hooks/useReviseMode', () => ({ useReviseMode: () => ({ data: mockReviseOn }) }));
let mockFlags: Record<string, boolean> = { revise_mode: true };
jest.mock('@/hooks/useFeatureFlags', () => ({ useFeatureFlags: () => ({ data: mockFlags }) }));
const mockAuth = { isAuthenticated: true, role: 'teacher' as string | null };
jest.mock('@/stores/authStore', () => ({ useAuthStore: (sel: (s: typeof mockAuth) => unknown) => sel(mockAuth) }));

import { RevisionThemeGuard, RevisionThemeSync, resetRevisionSync } from '../useRevisionTheme';
import { CURTAIN_IN_MS, useThemeStore } from '@/stores/themeStore';
import { applyScheme } from '@/theme/index';

/**
 * The sync lives INSIDE the tree that the season's own re-key rebuilds. Its unmount must
 * therefore never lift the season (that looped the app: apply → re-key → unmount → lift →
 * re-key → …, simulator 2026-10-16). Lifting is the root guard's job, on sign-out only.
 */
beforeEach(() => {
  jest.useFakeTimers();
  applyScheme('light');
  resetRevisionSync();
  useThemeStore.setState({ revision: false, curtain: null, paintEpoch: 0, returnTo: null });
  mockReviseOn = true; mockFlags = { revise_mode: true }; mockPathname = '/'; mockAuth.isAuthenticated = true; mockAuth.role = 'teacher';
});
afterEach(() => { useThemeStore.getState().setRevision(false); jest.useRealTimers(); });

describe('RevisionThemeSync', () => {
  it('applies the first known value silently, and survives its own unmount', () => {
    let tree!: ReactTestRenderer;
    act(() => { tree = create(createElement(RevisionThemeSync)); });
    expect(useThemeStore.getState()).toMatchObject({ revision: true, curtain: null, paintEpoch: 1 });
    act(() => { tree.unmount(); });
    expect(useThemeStore.getState().revision).toBe(true);
    // Remounted by the re-key: nothing more to do, no second re-key.
    act(() => { tree = create(createElement(RevisionThemeSync)); });
    expect(useThemeStore.getState().paintEpoch).toBe(1);
    act(() => { tree.unmount(); });
  });

  it('a later change raises the curtain and comes back to the screen it was flipped on', () => {
    mockReviseOn = false;
    let tree!: ReactTestRenderer;
    act(() => { tree = create(createElement(RevisionThemeSync)); });
    expect(useThemeStore.getState().revision).toBe(false);
    mockReviseOn = true; mockPathname = '/settings';
    act(() => { tree.update(createElement(RevisionThemeSync)); });
    expect(useThemeStore.getState().curtain).toMatchObject({ to: true });
    act(() => { jest.advanceTimersByTime(CURTAIN_IN_MS); });
    expect(useThemeStore.getState().revision).toBe(true);
    expect(useThemeStore.getState().peekReturnTo()).toBe('/settings');
    act(() => { tree.unmount(); });
  });

  it('needs the flag AND an explicit true; unknown changes nothing', () => {
    mockReviseOn = undefined;
    let tree!: ReactTestRenderer;
    act(() => { tree = create(createElement(RevisionThemeSync)); });
    expect(useThemeStore.getState().revision).toBe(false);
    act(() => { tree.unmount(); });
    mockFlags = {}; mockReviseOn = true;
    act(() => { tree = create(createElement(RevisionThemeSync)); });
    expect(useThemeStore.getState().revision).toBe(false);
    act(() => { tree.unmount(); });
  });
});

describe('RevisionThemeGuard', () => {
  it('lifts the season on sign-out, and leaves a signed-in teacher alone', () => {
    useThemeStore.getState().setRevision(true);
    let tree!: ReactTestRenderer;
    act(() => { tree = create(createElement(RevisionThemeGuard)); });
    expect(useThemeStore.getState().revision).toBe(true);
    mockAuth.isAuthenticated = false;
    act(() => { tree.update(createElement(RevisionThemeGuard)); });
    expect(useThemeStore.getState().revision).toBe(false);
    act(() => { tree.unmount(); });
  });
});
