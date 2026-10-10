import { routePattern, track, trackScreen } from '../analytics';

describe('analytics', () => {
  it('turns a path into a pattern: no id, token or long code leaves the phone', () => {
    expect(routePattern('/sessions/812')).toBe('/sessions/[id]');
    expect(routePattern('/student-sheet/45?name=أحمد')).toBe('/student-sheet/[id]');
    expect(routePattern('/impersonate/3f9a2c7e-11aa-4b2c-9d10-aa22bb33cc44')).toBe('/impersonate/[id]');
    expect(routePattern('/cash-collections')).toBe('/cash-collections');
    expect(routePattern('')).toBe('/');
  });

  it('is a silent no-op where the native module is absent (tests, old builds)', () => {
    expect(() => track('payment_collected', { kind: 'bill', value: 300 })).not.toThrow();
    expect(() => trackScreen('/sessions/[id]')).not.toThrow();
  });
});
