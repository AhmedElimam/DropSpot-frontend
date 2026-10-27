import { floatingNotchPath, RAISE, NOTCH_R, PILL_HEIGHT } from '../FloatingTabBar';

describe('floatingNotchPath', () => {
  it('is a stadium with a circular cut around the middle of its top edge, symmetric about the centre', () => {
    const d = floatingNotchPath(374, PILL_HEIGHT);
    const arc = /L ([\d.]+) 20 A 34 34 0 1 0 ([\d.]+) 20/.exec(d);
    expect(arc).not.toBeNull();
    const [, a, b] = arc!;
    expect((Number(a) + Number(b)) / 2).toBeCloseTo(187, 1);
    expect(Number(b) - Number(a)).toBeLessThan(NOTCH_R * 2);
  });

  it('starts at the raised top edge and closes', () => {
    const d = floatingNotchPath(374, PILL_HEIGHT);
    expect(d.startsWith(`M 31 ${RAISE}`)).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    // The stadium's ends are full semicircles of the pill's half height.
    expect(d).toContain(`A 31 31 0 0 1 343 ${RAISE + PILL_HEIGHT}`);
  });
});
