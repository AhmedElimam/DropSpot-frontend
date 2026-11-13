jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
import { onTabPage } from '../Refreshable';

describe('only a list on a tab page drives the floating tab bar', () => {
  it('a tab page does', () => {
    expect(onTabPage({ getState: () => ({ type: 'tab' }) })).toBe(true);
  });
  it('a page pushed over the tabs (a stack screen) does not — its scroll used to leave Home without its bar', () => {
    expect(onTabPage({ getState: () => ({ type: 'stack' }) })).toBe(false);
  });
  it('outside any navigator (a root modal), or a navigator that throws, does not', () => {
    expect(onTabPage(undefined)).toBe(false);
    expect(onTabPage({ getState: () => { throw new Error('gone'); } })).toBe(false);
  });
});
