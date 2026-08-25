import { isVersionBelow } from '../semver';

describe('isVersionBelow (min-version gate)', () => {
  it('is true when current is below min', () => {
    expect(isVersionBelow('1.0.0', '1.4.0')).toBe(true);
    expect(isVersionBelow('1.3.9', '1.4.0')).toBe(true);
    expect(isVersionBelow('0.9.0', '1.0.0')).toBe(true);
  });

  it('is false at or above min', () => {
    expect(isVersionBelow('1.4.0', '1.4.0')).toBe(false); // equal → passes
    expect(isVersionBelow('2.0.0', '1.4.0')).toBe(false);
    expect(isVersionBelow('1.4.1', '1.4.0')).toBe(false);
  });

  it('treats missing parts as 0', () => {
    expect(isVersionBelow('1', '1.0.1')).toBe(true);
    expect(isVersionBelow('1.0', '1.0.0')).toBe(false);
  });
});
