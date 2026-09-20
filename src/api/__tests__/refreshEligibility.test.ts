/**
 * Which 401s may trigger a token refresh.
 *
 * The rule exists because of a specific runaway: a 401 on /auth/logout sent the interceptor
 * into a refresh, the refresh failed, and the failure handler called logout() again —
 * POST /auth/logout → 401 → refresh → logout() → forever, hundreds of times a second
 * (founder 2026-09-20). logout()'s own try/catch could not stop it: the recursion happens in
 * the INTERCEPTOR, one level above the call it is catching. Only excluding the path does.
 */
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.2.2', hostUri: '127.0.0.1:8081' } }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

import { shouldAttemptRefresh } from '../client';

describe('a 401 on an auth endpoint', () => {
  it.each(['/auth/login', '/auth/refresh', '/auth/logout'])('is never refreshed: %s', (url) => {
    expect(shouldAttemptRefresh(401, url, false)).toBe(false);
  });

  it('is not refreshed on an absolute URL either — the check is a substring, not an exact path', () => {
    expect(shouldAttemptRefresh(401, 'http://127.0.0.1:8000/api/v1/auth/logout', false)).toBe(false);
  });
});

describe('a 401 on an ordinary endpoint', () => {
  it('is refreshed once', () => {
    expect(shouldAttemptRefresh(401, '/teacher/insights', false)).toBe(true);
  });

  it('is not refreshed twice — _retry is what stops a retry loop on a normal call', () => {
    expect(shouldAttemptRefresh(401, '/teacher/insights', true)).toBe(false);
  });
});

describe('anything that is not a 401', () => {
  it.each([403, 404, 422, 500, undefined])('is left alone: %s', (status) => {
    expect(shouldAttemptRefresh(status as number | undefined, '/teacher/insights', false)).toBe(false);
  });
});
