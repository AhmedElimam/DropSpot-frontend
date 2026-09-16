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

import { useAuthStore } from '../authStore';

const ADMIN = { id: 1, user_type_id: 1, first_name: 'مدير', last_name: 'النظام' };
const TEACHER = { id: 2, user_type_id: 3, first_name: 'أحمد', last_name: 'محمد' };

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
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
