import { canHide, MIN_EXTENT, reportListScroll, showTabBar, useTabBarScroll } from '../tabBarScroll';

/** The floating tab bar hides on a scroll down only where there is real room to scroll. */
describe('when the floating bar may hide', () => {
  beforeEach(() => showTabBar());

  it('a short page never hides it, however it is scrolled', () => {
    expect(canHide(844 + 200, 844)).toBe(false);
    reportListScroll(150, 844 + 200, 844);
    expect(useTabBarScroll.getState().hidden).toBe(false);
  });

  it('a long page hides it on a scroll down and shows it on a scroll up', () => {
    const h = 844 + MIN_EXTENT + 400;
    expect(canHide(h, 844)).toBe(true);
    reportListScroll(60, h, 844);
    expect(useTabBarScroll.getState().hidden).toBe(true);
    reportListScroll(20, h, 844);
    expect(useTabBarScroll.getState().hidden).toBe(false);
  });

  it('a page that shrank while the bar was away brings it back', () => {
    const long = 844 + MIN_EXTENT + 400;
    reportListScroll(80, long, 844);
    expect(useTabBarScroll.getState().hidden).toBe(true);
    reportListScroll(80, 900, 844);
    expect(useTabBarScroll.getState().hidden).toBe(false);
  });
});
