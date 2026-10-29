import { COMMIT, COMMIT_VELOCITY, swipeCommits } from '../TabSwipeHome';

jest.mock('react-native-gesture-handler', () => ({ Gesture: {}, GestureDetector: () => null }));
jest.mock('react-native-reanimated', () => ({}));
jest.mock('@/components/ui/Icon', () => ({ Icon: () => null }));

describe('swipe back from a tab to Home (founder 2026-10-29)', () => {
  it('goes home past the line', () => {
    expect(swipeCommits(COMMIT, 0)).toBe(true);
    expect(swipeCommits(COMMIT + 40, 0)).toBe(true);
  });
  it('a quick flick goes home before the line, a nudge does not', () => {
    expect(swipeCommits(30, COMMIT_VELOCITY + 1)).toBe(true);
    expect(swipeCommits(10, COMMIT_VELOCITY + 400)).toBe(false);
  });
  it('a slow short drag stays', () => {
    expect(swipeCommits(COMMIT - 1, 100)).toBe(false);
  });
});
