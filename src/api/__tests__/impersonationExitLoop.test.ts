/**
 * The exit from impersonation, end to end on the client: the REAL axios client (its 401
 * recovery interceptor) + the REAL auth store, against a scripted server that revokes tokens
 * the way the API does. Founder 2026-10-02: «on exit impersonation it makes loops until it
 * crashes out» — the Metro log was the role layout's push registration repeating hundreds
 * of times, i.e. the authenticated/impersonating state flapping or the recovery path
 * re-entering itself. Every scenario here must settle in a bounded number of requests and
 * state transitions.
 */
const secure: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => (k in secure ? secure[k] : null)),
  setItemAsync: jest.fn(async (k: string, v: string) => { secure[k] = v; }),
  deleteItemAsync: jest.fn(async (k: string) => { delete secure[k]; }),
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.0', hostUri: '10.0.0.5:8081' } } }));
jest.mock('@/api/apiBase', () => ({ ensureApiBaseHydrated: async () => {}, getApiBaseOverride: () => null }));
jest.mock('@/utils/appIdentity', () => ({ resolveAppId: () => 'com.test.app' }));

import axios, { type AxiosRequestConfig } from 'axios';
import client from '../client';
import { useAuthStore } from '@/stores/authStore';
import { setCachedAccessToken } from '../tokenCache';

const ADMIN = { id: 1, user_type_id: 1, first_name: 'مدير', last_name: 'النظام' };
const TEACHER = { id: 2, user_type_id: 3, first_name: 'أحمد', last_name: 'محمد' };

/** A tiny server: who each bearer is, which are revoked, and what each route does. */
class FakeServer {
  tokens = new Map<string, { user: typeof ADMIN; impersonation: boolean }>();
  revoked = new Set<string>();
  refreshTokens = new Map<string, typeof ADMIN>();
  requests: string[] = [];

  issue(token: string, user: typeof ADMIN, impersonation = false) { this.tokens.set(token, { user, impersonation }); }

  handle = async (config: AxiosRequestConfig) => {
    const url = (config.url ?? '').replace(/^.*\/api\/v1/, '');
    this.requests.push(`${(config.method ?? 'get').toUpperCase()} ${url}`);
    if (this.requests.length > 60) throw new Error(`runaway: ${this.requests.length} requests`);

    const reply = (status: number, data: unknown = {}) => {
      if (status >= 400) {
        const err = new axios.AxiosError('http', String(status), config as never, null, { status, data, statusText: '', headers: {}, config: config as never });
        err.response = { status, data, statusText: '', headers: {}, config: config as never };
        throw err;
      }
      return { status, data, statusText: 'OK', headers: {}, config: config as never };
    };

    if (url === '/auth/refresh') {
      const rt = String((JSON.parse(config.data ?? '{}') as { refresh_token?: string }).refresh_token ?? '');
      const user = this.refreshTokens.get(rt);
      if (!user) return reply(401, { message: 'Unauthenticated' });
      this.refreshTokens.delete(rt);                       // rotated
      const at = `at-${this.requests.length}`; const nrt = `rt-${this.requests.length}`;
      this.issue(at, user); this.refreshTokens.set(nrt, user);
      return reply(200, { data: { attributes: { user, tokens: { access_token: at, refresh_token: nrt } } } });
    }

    const bearer = String((config.headers as Record<string, string> | undefined)?.Authorization ?? '').replace('Bearer ', '');
    const t = this.tokens.get(bearer);
    if (!t || this.revoked.has(bearer)) return reply(401, { message: 'Unauthenticated' });

    if (url === '/impersonation/stop') { this.revoked.add(bearer); return reply(200, { data: { ended: true } }); }
    if (url === '/auth/logout') {
      // The server-side fix: a sign-out inside a browse session revokes that token only.
      if (t.impersonation) { this.revoked.add(bearer); return reply(200); }
      for (const [tok, v] of this.tokens) if (v.user.id === t.user.id) this.revoked.add(tok);
      return reply(200);
    }
    return reply(200, { data: [] });
  };
}

let server: FakeServer;
let flips: number;      // false→true transitions of (authenticated && !impersonating): one push registration each
let switches: number;   // changes of the session key the SessionSwitchWatcher routes on
let trail: string[];    // every key change, for the failure message
let unsubscribe: () => void = () => {};

/** Start counting from the CURRENT state (after a scenario's setup). */
function watch() {
  unsubscribe();
  flips = 0; switches = 0; trail = [];
  const keyOf = (s: ReturnType<typeof useAuthStore.getState>) => (s.isAuthenticated ? `${s.user?.id}:${s.impersonation?.active ? 'imp' : 'own'}` : 'out');
  const liveOf = (s: ReturnType<typeof useAuthStore.getState>) => s.isAuthenticated && !s.impersonation?.active;
  let wasLive = liveOf(useAuthStore.getState()); let lastKey = keyOf(useAuthStore.getState());
  unsubscribe = useAuthStore.subscribe((s) => {
    const live = liveOf(s);
    if (live && !wasLive) flips++;
    wasLive = live;
    const key = keyOf(s);
    if (key !== lastKey) { switches++; trail.push(key); lastKey = key; }
  });
}

beforeEach(() => {
  for (const k of Object.keys(secure)) delete secure[k];
  server = new FakeServer();
  client.defaults.adapter = server.handle;
  setCachedAccessToken(null);
});
afterEach(() => { unsubscribe(); unsubscribe = () => {}; });

/** The device is mid-impersonation, started from the in-app picker (admin stashed). */
function impersonatingFromPicker() {
  server.issue('admin-at', ADMIN); server.refreshTokens.set('admin-rt', ADMIN);
  server.issue('imp-at', TEACHER, true);
  secure.access_token = 'imp-at'; secure.refresh_token = '';
  secure.imp_admin_token = 'admin-at'; secure.imp_admin_refresh = 'admin-rt'; secure.imp_admin_user = JSON.stringify(ADMIN);
  setCachedAccessToken('imp-at');
  useAuthStore.setState({
    user: TEACHER as never, role: 'teacher', activeTeacherId: null, isAuthenticated: true, isLoading: false, switching: false,
    impersonation: { active: true, name: 'أحمد محمد', write: false },
  });
}

const settle = () => new Promise((r) => setTimeout(r, 50));

describe('leaving impersonation against a real client + server behaviour', () => {
  it('«خروج» with in-flight teacher requests dying at the same time lands on the picker once', async () => {
    impersonatingFromPicker(); watch();
    const exit = useAuthStore.getState().leaveImpersonation();
    // The home screen's polls, sent with the impersonation token as it is being revoked.
    const inflight = ['/teacher/sessions/today', '/notifications/unread-count', '/tickets']
      .map((u) => client.get(u).catch(() => 'failed'));
    expect(await exit).toBe('admin');
    await Promise.all(inflight);
    await settle();

    const s = useAuthStore.getState();
    expect(s).toMatchObject({ role: 'admin', isAuthenticated: true, impersonation: null, switching: false });
    expect(secure.access_token).toBe('admin-at');
    expect(server.requests.length).toBeLessThan(12);
    expect([flips, trail]).toEqual([1, ['1:own']]);   // one push registration, one route, both for the admin
  });

  it('the token already expired: the first 401 restores the admin, nothing loops', async () => {
    impersonatingFromPicker(); watch();
    server.revoked.add('imp-at');                // 15 minutes passed
    const results = await Promise.all(['/teacher/sessions/today', '/notifications/unread-count', '/teacher/cash/reconciliation']
      .map((u) => client.get(u).then(() => 'ok', () => 'failed')));
    await settle();

    expect(results.every((r) => r === 'failed')).toBe(true);
    expect(useAuthStore.getState()).toMatchObject({ role: 'admin', isAuthenticated: true, impersonation: null });
    expect(server.requests.length).toBeLessThan(10);
    expect([flips, trail]).toEqual([1, ['1:own']]);
  });

  it('a QR hand-off (no admin on this phone) whose token is dead signs out, bounded', async () => {
    server.issue('imp-at', TEACHER, true);
    server.revoked.add('imp-at');
    secure.access_token = 'imp-at'; secure.refresh_token = '';
    setCachedAccessToken('imp-at');
    useAuthStore.setState({ user: TEACHER as never, role: 'teacher', isAuthenticated: true, isLoading: false, impersonation: { active: true, name: 'x', write: false } });
    watch();

    await Promise.all(['/teacher/sessions/today', '/notifications/unread-count'].map((u) => client.get(u).catch(() => null)));
    await settle();

    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, user: null, switching: false });
    expect(server.requests.length).toBeLessThan(10);
    expect(flips).toBe(0);
  });

  it('relaunch after a crash mid-exit: dead impersonation persisted, stash gone → login, bounded', async () => {
    server.issue('imp-at', TEACHER, true); server.revoked.add('imp-at');
    secure.access_token = 'imp-at'; secure.refresh_token = '';
    secure.session_data = JSON.stringify({ user: TEACHER, role: 'teacher', activeTeacherId: null, impersonation: { active: true, name: 'x', write: false } });
    useAuthStore.setState({ user: null, role: null, isAuthenticated: false, isLoading: true, impersonation: null });

    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().impersonation?.active).toBe(true);
    watch();
    await Promise.all(['/teacher/sessions/today', '/notifications/unread-count', '/surveys/pending'].map((u) => client.get(u).catch(() => null)));
    await settle();

    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, switching: false });
    expect(server.requests.length).toBeLessThan(10);
  });

  it('exit, then a second impersonation from the picker, works and routes exactly twice', async () => {
    impersonatingFromPicker(); watch();
    expect(await useAuthStore.getState().leaveImpersonation()).toBe('admin');
    await settle();

    // The picker: stash the admin, start, swap — as app/(admin)/impersonate.tsx does.
    secure.imp_admin_token = secure.access_token; secure.imp_admin_refresh = secure.refresh_token; secure.imp_admin_user = JSON.stringify(ADMIN);
    server.issue('imp2-at', TEACHER, true);
    await useAuthStore.getState().beginImpersonation({ access: 'imp2-at', refresh: '' }, TEACHER as never, { active: true, name: 'أحمد', write: false });
    await client.get('/teacher/sessions/today');
    await settle();

    expect(useAuthStore.getState()).toMatchObject({ role: 'teacher', impersonation: { active: true } });
    expect(server.requests.filter((r) => r.endsWith('/auth/logout'))).toHaveLength(0);
    expect([flips, trail]).toEqual([1, ['1:own', '2:imp']]);
  });
});
