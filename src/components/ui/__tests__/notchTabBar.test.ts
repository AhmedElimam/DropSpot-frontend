import { notchPath, BUTTON, NOTCH_R, RAISE } from '../NotchTabBar';

/** The bar's outline: a symmetric cut in the middle, the right size for the raised button. */
describe('notchPath', () => {
  it('cuts a circle around the centre button, symmetric about the middle', () => {
    const width = 390;
    const d = notchPath(width, 98);
    const arc = d.match(new RegExp(`L ([\\d.]+) ${RAISE} A ([\\d.]+) \\2 0 1 0 ([\\d.]+) ${RAISE}`));
    expect(arc).not.toBeNull();
    const [, left, radius, right] = arc!;
    expect(Number(radius)).toBe(NOTCH_R);
    expect(Number(left) + Number(right)).toBeCloseTo(width, 1);
    // The cut is wider than the button, so the button never touches the bar.
    expect(Number(right) - Number(left)).toBeGreaterThan(BUTTON);
    expect(Number(right) - Number(left)).toBeLessThanOrEqual(NOTCH_R * 2);
  });

  it('starts at the raised top edge and closes along the bottom', () => {
    const d = notchPath(360, 100);
    expect(d.startsWith(`M 0 ${RAISE + 24}`)).toBe(true);
    expect(d).toContain(`L 360 ${RAISE + 100}`);
    expect(d.endsWith('Z')).toBe(true);
  });
});
