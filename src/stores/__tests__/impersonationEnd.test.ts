/**
 * An impersonation token is unrefreshable and expires after 15 minutes BY DESIGN, so the
 * first 401 after that is its ordinary end. What must NOT happen is the super-admin being
 * signed out with it: logout() deliberately deletes the imp_admin_* stash, so doing that
 * here destroyed the admin's own session and forced a fresh login every 15 minutes.
 */
const store: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => (k in store ? store[k] : null)),
  setItemAsync: jest.fn(async (k: string, v: string) => { store[k] = v; }),
  deleteItemAsync: jest.fn(async (k: string) => { delete store[k]; }),
}));

// The revoke and the server sign-out are network calls; count them, never make them.
const mockStopImpersonation = jest.fn(async () => {});
jest.mock('@/api/impersonation', () => ({ stopImpersonation: () => mockStopImpersonation() }));
jest.mock('@/api/auth', () => ({ logout: jest.fn(async () => {}) }));

import { useAuthStore } from '../authStore';

const ADMIN = { id: 1, user_type_id: 1, first_name: 'مدير', last_name: 'النظام' };
const TEACHER = { id: 2, user_type_id: 3, first_name: 'أحمد', last_name: 'محمد' };

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  mockStopImpersonation.mockClear();
  useAuthStore.setState({
    user: TEACHER as never, role: 'teacher', activeTeacherId: null,
    impersonation: { active: true, name: 'أحمد محمد', write: false },
    isAuthenticated: true, isLoading: false,
  });
});

describe('an impersonation session that expires', () => {
  it('hands the super-admin back their own session instead of signing them out', async () => {
    store.access_token = 'impersonation-token';
    store.refresh_token = '';                       // impersonation sessions carry none
    store.imp_admin_token = 'admin-access';
    store.imp_admin_refresh = 'admin-refresh';
    store.imp_admin_user = JSON.stringify(ADMIN);

    await useAuthStore.getState().endImpersonationOrLogout();

    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.role).toBe('admin');                   // → app/index.tsx lands on the picker
    expect(s.user).toMatchObject({ id: 1 });
    expect(s.impersonation).toBeNull();

    // The admin's real tokens are live again, and the stash is consumed exactly once.
    expect(store.access_token).toBe('admin-access');
    expect(store.refresh_token).toBe('admin-refresh');
    expect(store.imp_admin_token).toBeUndefined();
  });

  it('signs out normally when there is no admin behind it', async () => {
    store.access_token = 'plain-expired-token';
    store.refresh_token = 'dead-refresh';

    await useAuthStore.getState().endImpersonationOrLogout();

    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.user).toBeNull();
    expect(store.access_token).toBeUndefined();
  });

  it('refuses to restore half a session when the admin profile is missing', async () => {
    store.imp_admin_token = 'admin-access';         // tokens but no profile blob
    await useAuthStore.getState().endImpersonationOrLogout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('leaving impersonation (2026-09-29: the app crashed on «خروج» / logout)', () => {
  const stash = () => {
    store.access_token = 'impersonation-token';
    store.imp_admin_token = 'admin-access';
    store.imp_admin_refresh = 'admin-refresh';
    store.imp_admin_user = JSON.stringify(ADMIN);
  };

  it('restores the admin exactly once when «خروج» and a burst of 401s arrive together', async () => {
    stash();
    const results = await Promise.all([
      useAuthStore.getState().leaveImpersonation(),     // the banner
      useAuthStore.getState().endImpersonationOrLogout(), // 401 #1
      useAuthStore.getState().endImpersonationOrLogout(), // 401 #2
      useAuthStore.getState().leaveImpersonation(),     // a double tap
    ]);

    expect(results[0]).toBe('admin');
    expect(mockStopImpersonation).toHaveBeenCalledTimes(1);   // one revoke, not four
    const s = useAuthStore.getState();
    expect(s.role).toBe('admin');                          // never signed out by a loser of the race
    expect(s.isAuthenticated).toBe(true);
    expect(s.impersonation).toBeNull();
    expect(s.switching).toBe(false);
    expect(store.access_token).toBe('admin-access');
  });

  it('enters in one step: never the target with no impersonation flag', async () => {
    useAuthStore.setState({ user: ADMIN as never, role: 'admin', impersonation: null });
    const seen: Array<{ role: string | null; imp: boolean }> = [];
    const unsub = useAuthStore.subscribe((st) => seen.push({ role: st.role, imp: !!st.impersonation?.active }));

    await useAuthStore.getState().beginImpersonation(
      { access: 'imp-access', refresh: '' }, TEACHER as never, { active: true, name: 'أحمد محمد', write: true },
    );
    unsub();

    expect(seen.some((x) => x.role === 'teacher' && !x.imp)).toBe(false);
    expect(useAuthStore.getState()).toMatchObject({ role: 'teacher', switching: false, impersonation: { active: true, write: true } });
    expect(store.access_token).toBe('imp-access');
  });

  it('a QR hand-off with no admin behind it ends in a sign-out, revoked first', async () => {
    store.access_token = 'impersonation-token';
    expect(await useAuthStore.getState().leaveImpersonation()).toBe('login');
    expect(mockStopImpersonation).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

