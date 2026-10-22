import { notifyManager } from '@tanstack/react-query';
import { _resetTransitions, inTransition, installTransitionScheduler, markTransition, settle, subscribeTransitions, transitionListeners, TRANSITION_MAX_MS } from '../transitions';

/**
 * The transition hold (src/navigation/transitions.ts): while a native stack slides, React Query
 * keeps its notifications and `useOnScreen` waits. Both release at `transitionEnd`, a cancelled
 * gesture, or the cap — never later, never earlier.
 */
describe('the transition hold', () => {
  beforeEach(() => { jest.useFakeTimers(); _resetTransitions(); });
  afterEach(() => { jest.useRealTimers(); });

  it('is on from transitionStart to transitionEnd, and tells its subscribers once each way', () => {
    const seen: boolean[] = [];
    subscribeTransitions(() => seen.push(inTransition()));
    expect(inTransition()).toBe(false);
    transitionListeners.transitionStart();
    transitionListeners.transitionStart(); // the arriving screen reports too
    expect(inTransition()).toBe(true);
    transitionListeners.transitionEnd();
    expect(inTransition()).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it('a cancelled swipe releases it', () => {
    markTransition();
    transitionListeners.gestureCancel();
    expect(inTransition()).toBe(false);
  });

  it('expires on its own when no end ever comes', () => {
    const seen: boolean[] = [];
    subscribeTransitions(() => seen.push(inTransition()));
    markTransition();
    jest.advanceTimersByTime(TRANSITION_MAX_MS - 1);
    expect(inTransition()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(inTransition()).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it('holds React Query notifications while sliding and flushes them at the end, in order', () => {
    installTransitionScheduler();
    const ran: string[] = [];
    markTransition();
    notifyManager.schedule(() => ran.push('a'));
    notifyManager.schedule(() => ran.push('b'));
    jest.advanceTimersByTime(50);
    expect(ran).toEqual([]);
    settle();
    expect(ran).toEqual(['a', 'b']);

    // Not sliding: the default behaviour, a macrotask.
    notifyManager.schedule(() => ran.push('c'));
    expect(ran).toEqual(['a', 'b']);
    jest.advanceTimersByTime(0);
    expect(ran).toEqual(['a', 'b', 'c']);
  });

  it('the cap flushes the held notifications too', () => {
    installTransitionScheduler();
    const ran: string[] = [];
    markTransition();
    notifyManager.schedule(() => ran.push('late'));
    jest.advanceTimersByTime(TRANSITION_MAX_MS);
    expect(ran).toEqual(['late']);
  });
});
