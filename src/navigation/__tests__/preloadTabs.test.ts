/**
 * Tabs are built in the background after launch settles (no blank first frame on a tab's
 * first tap), one at a time, never the focused one, never twice, never in the background.
 */
jest.mock('react-native', () => ({
  AppState: { currentState: 'active' },
  InteractionManager: { runAfterInteractions: (fn: () => void) => { fn(); return { cancel: jest.fn() }; } },
}));

import { scheduleTabPreload, PRELOAD_START_MS, PRELOAD_GAP_MS, type PreloadTabState } from '../usePreloadTabs';

const routes = ['index', 'sessions', 'manage', 'students', 'settings'].map((name) => ({ key: `${name}-k`, name }));

describe('scheduleTabPreload', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('preloads every visible tab but the focused one, one per gap, after the start delay', () => {
    const preload = jest.fn();
    const state: PreloadTabState = { index: 0, routes, preloadedRouteKeys: [] };
    scheduleTabPreload({ preload }, () => ({ state, tabs: routes.map((r) => r.name) }), () => true);

    jest.advanceTimersByTime(PRELOAD_START_MS - 1);
    expect(preload).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1); // the start delay ends; the first tab is due right after
    jest.advanceTimersByTime(1);
    expect(preload.mock.calls.map((c) => c[0])).toEqual(['sessions']);
    jest.advanceTimersByTime(PRELOAD_GAP_MS * 3);
    expect(preload.mock.calls.map((c) => c[0])).toEqual(['sessions', 'manage', 'students', 'settings']);
  });

  it('skips a tab the user opened or that is already preloaded, and hidden tabs', () => {
    const preload = jest.fn();
    let state: PreloadTabState = { index: 0, routes, preloadedRouteKeys: [] };
    // `manage` is hidden by the backend: not in the visible list.
    scheduleTabPreload({ preload }, () => ({ state, tabs: ['index', 'sessions', 'students', 'settings'] }), () => true);
    // The user opened Sessions (Home is in the history: built); Students was already preloaded.
    state = { index: 1, routes, preloadedRouteKeys: ['students-k'], history: [{ type: 'route', key: 'index-k' }, { type: 'route', key: 'sessions-k' }] };
    jest.advanceTimersByTime(PRELOAD_START_MS + PRELOAD_GAP_MS * 5);
    expect(preload.mock.calls.map((c) => c[0])).toEqual(['settings']);
  });

  it('does nothing in the background or once cancelled, and survives a navigator without preload', () => {
    const preload = jest.fn();
    const state: PreloadTabState = { index: 0, routes };
    scheduleTabPreload({ preload }, () => ({ state, tabs: ['index', 'sessions'] }), () => false);
    jest.advanceTimersByTime(PRELOAD_START_MS + PRELOAD_GAP_MS);
    expect(preload).not.toHaveBeenCalled();

    const cancel = scheduleTabPreload({ preload }, () => ({ state, tabs: ['index', 'sessions'] }), () => true);
    cancel();
    jest.advanceTimersByTime(PRELOAD_START_MS + PRELOAD_GAP_MS);
    expect(preload).not.toHaveBeenCalled();

    const throwing = jest.fn(() => { throw new Error('not supported'); });
    scheduleTabPreload({ preload: throwing }, () => ({ state, tabs: ['index', 'sessions'] }), () => true);
    expect(() => jest.advanceTimersByTime(PRELOAD_START_MS + PRELOAD_GAP_MS)).not.toThrow();
    expect(throwing).toHaveBeenCalledTimes(1);
  });
});
