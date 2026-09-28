import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@/types/user';
import { setCachedAccessToken } from '@/api/tokenCache';

export type UserRole = 'student' | 'parent' | 'teacher' | 'assistant' | 'admin';

/**
 * Single source of truth for role. Derived from the authoritative `user_type_id`
 * (1/2=admin, 3=teacher, 6=assistant, 5/has-student=student, else parent),
 * numeric-safe in case the API serializes the id as a string. We intentionally do
 * NOT trust the backend's top-level `role` (null for teachers) or the appended
 * `user.role` ('tutor' for teachers) — both have led to teachers landing in the
 * parent app. 'admin' (super-admin / admin) has no normal app — only the
 * impersonation picker.
 */
export function resolveRole(user: { user_type_id?: number | string | null; student_id?: number | null } | null | undefined): UserRole {
  const t = Number(user?.user_type_id);
  if (t === 1 || t === 2) return 'admin';
  if (t === 3) return 'teacher';
  if (t === 6) return 'assistant';
  if (t === 5 || user?.student_id) return 'student';
  return 'parent';
}

// A super-admin impersonation session running on this device (mobile impersonation).
// `active` is the banner switch; `write` reflects the token's write mode.
export interface ImpersonationState {
  active: boolean;
  name: string;
  write: boolean;
}

interface AuthState {
  user: User | null;
  role: UserRole | null;
  // For an ASSISTANT: the teacher context currently active on this device. A
  // teacher's own context is always their user id (see stampTeacherId). Kept in
  // sync with the server's token context via /auth/my-teachers + switch-teacher.
  activeTeacherId: number | null;
  // Non-null only while a super-admin impersonation session is active on this device.
  impersonation: ImpersonationState | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setTokens: (access: string, refresh: string) => Promise<void>;
  setSession: (user: User, role: UserRole) => Promise<void>;
  setActiveTeacherId: (id: number | null) => Promise<void>;
  setImpersonation: (imp: ImpersonationState | null) => Promise<void>;
  /**
   * True while the session is being swapped (entering or leaving impersonation). The root
   * shows a cover meanwhile, so no screen renders half of one session and half of the other.
   */
  switching: boolean;
  /** Enter impersonation in ONE step: tokens, target user, role and the flag together. */
  beginImpersonation: (tokens: { access: string; refresh: string }, user: User, imp: ImpersonationState) => Promise<void>;
  /**
   * Leave impersonation — «خروج», signing out while impersonating, or the impersonation
   * token dying on its own. Single-flight: every caller gets the same run. Revokes the
   * impersonation token, then restores the super-admin's own session (picker) or, with no
   * stash (QR hand-off), signs out. Navigation is NOT done here: the root watches the
   * session and routes once (see SessionSwitchWatcher).
   */
  leaveImpersonation: () => Promise<'admin' | 'login'>;
  logout: () => Promise<void>;
  /** An impersonation session ended by itself → return to the admin, not to the login screen. */
  endImpersonationOrLogout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const SESSION_KEY = 'session_data';

// The one in-flight «leave impersonation», shared by every caller (see leaveImpersonation).
let leaving: Promise<'admin' | 'login'> | null = null;

/**
 * The teacher id to stamp onto a scan, from the current auth state:
 *  - teacher → their own user id;
 *  - assistant → the active teacher context (null until resolved);
 *  - anyone else → null.
 * Stamping happens at SCAN time so offline attribution can never drift (§4).
 */
export function stampTeacherId(state: Pick<AuthState, 'role' | 'user' | 'activeTeacherId'>): number | null {
  if (state.role === 'teacher') return state.user?.id ?? null;
  if (state.role === 'assistant') return state.activeTeacherId ?? null;
  return null;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Persist the full session blob (so impersonation survives a relaunch too).
  const persist = async (user: User, role: UserRole, activeTeacherId: number | null, impersonation: ImpersonationState | null) => {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ user, role, activeTeacherId, impersonation }));
  };

  return {
    user: null,
    role: null,
    activeTeacherId: null,
    impersonation: null,
    switching: false,
    isAuthenticated: false,
    isLoading: true,

    setSession: async (user, role) => {
      const { activeTeacherId, impersonation } = get();
      // Update the in-memory store FIRST (synchronous) so a caller that navigates right
      // after — even without awaiting — never re-reads a stale gate flag (e.g. the Terms
      // gate bouncing back on first accept). Persist to disk after.
      set({ user, role, isAuthenticated: true });
      await persist(user, role, activeTeacherId, impersonation);
    },

    setActiveTeacherId: async (id) => {
      set({ activeTeacherId: id });
      const { user, role, impersonation } = get();
      if (user && role) {
        await persist(user, role, id, impersonation);
      }
    },

    setImpersonation: async (imp) => {
      set({ impersonation: imp });
      const { user, role, activeTeacherId } = get();
      if (user && role) {
        await persist(user, role, activeTeacherId, imp);
      }
    },

    setTokens: async (access, refresh) => {
      await SecureStore.setItemAsync('access_token', access);
      setCachedAccessToken(access);
      await SecureStore.setItemAsync('refresh_token', refresh);
    },

    /**
     * The session the app is holding has been refused and cannot be renewed.
     *
     * An IMPERSONATION token is deliberately unrefreshable and lives 15 minutes, so this
     * is its NORMAL end, not an error — and the super-admin who started it still has their
     * own session stashed under the imp_admin_* keys. Signing out here would delete that
     * stash (logout clears the crumbs on purpose) and dump an admin who did nothing wrong
     * on the login screen, which is what made this look like "impersonation logs me out at
     * random". Hand them back their own session instead; `app/index.tsx` sees role=admin
     * and lands them on the picker.
     *
     * With no stash — an ordinary expired session, or a QR hand-off that never had an
     * admin here — this is a real sign-out and falls through to logout().
     */
    beginImpersonation: async (tokens, user, imp) => {
      set({ switching: true });
      try {
        await get().setTokens(tokens.access, tokens.refresh);
        // One set(): there is never a moment where the app holds the target's user with no
        // impersonation flag — that half-state registered push tokens and opened popups.
        const role = resolveRole(user);
        set({ user, role, activeTeacherId: null, impersonation: imp, isAuthenticated: true });
        await persist(user, role, null, imp);
      } finally {
        set({ switching: false });
      }
    },

    leaveImpersonation: () => {
      if (leaving) return leaving;
      leaving = (async (): Promise<'admin' | 'login'> => {
        set({ switching: true });
        try {
          // Revoke the impersonation token FIRST, while it is still the bearer, so the
          // revoke can never land on the admin's restored token. Bounded: a dead network
          // must not trap the admin; the token expires on its own anyway (fail-closed).
          if (get().impersonation?.active) {
            try {
              // Required at call time, not imported at the top: api/impersonation →
              // api/client → this store is a cycle when static (same as logout below).
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { stopImpersonation } = require('@/api/impersonation') as typeof import('@/api/impersonation');
              await Promise.race([
                stopImpersonation().catch(() => {}),
                new Promise<void>((resolve) => setTimeout(resolve, 5000)),
              ]);
            } catch {
              // Module or network trouble: carry on, the local switch is what matters.
            }
          }

          const adminToken = await SecureStore.getItemAsync('imp_admin_token');
          const adminRefresh = await SecureStore.getItemAsync('imp_admin_refresh');
          const adminUserRaw = await SecureStore.getItemAsync('imp_admin_user');
          await SecureStore.deleteItemAsync('imp_admin_token');
          await SecureStore.deleteItemAsync('imp_admin_refresh');
          await SecureStore.deleteItemAsync('imp_admin_user');

          // Tokens without the admin's own profile would leave the app authenticated as
          // nobody. Restoring half a session is worse than asking for a login.
          if (! adminToken || ! adminUserRaw) {
            await get().logout();

            return 'login';
          }

          await SecureStore.setItemAsync('access_token', adminToken);
          setCachedAccessToken(adminToken);
          await SecureStore.setItemAsync('refresh_token', adminRefresh ?? '');
          const adminUser = JSON.parse(adminUserRaw);
          const role = resolveRole(adminUser);
          set({ user: adminUser, role, activeTeacherId: null, impersonation: null, isAuthenticated: true });
          await persist(adminUser, role, null, null);

          return 'admin';
        } finally {
          set({ switching: false });
          leaving = null;
        }
      })();

      return leaving;
    },

    /**
     * The session the app is holding has been refused and cannot be renewed.
     *
     * An IMPERSONATION token is deliberately unrefreshable and lives 15 minutes, so this
     * is its NORMAL end, not an error — and the super-admin who started it still has their
     * own session stashed under the imp_admin_* keys. Hand them back their own session
     * instead of signing out. Many requests 401 at once when it dies; they all join the
     * one leaveImpersonation() run, so the admin is restored exactly once.
     *
     * With no stash and no impersonation — an ordinary expired session — this is a real
     * sign-out.
     */
    endImpersonationOrLogout: async () => {
      if (leaving || get().impersonation?.active || (await SecureStore.getItemAsync('imp_admin_token'))) {
        await get().leaveImpersonation();

        return;
      }
      await get().logout();
    },

    logout: async () => {
      // Tell the server first, while the token is still readable — but never let a
      // failed/offline call trap the user in a signed-in state: the local clear below
      // always runs.
      try {
        // Loaded here, not at the top: api/auth → api/client → this store is a require
        // cycle when imported statically (Metro warned, and a cycle can hand back an
        // uninitialised module). A dynamic import resolves at call time, after both sides exist.
        const { logout: logoutRequest } = await import('@/api/auth');
        await logoutRequest();
      } catch {
        // Offline or already-expired token: the local sign-out is what the user sees.
      }
      await SecureStore.deleteItemAsync('access_token');
      setCachedAccessToken(null);
      await SecureStore.deleteItemAsync('refresh_token');
      await SecureStore.deleteItemAsync(SESSION_KEY);
      // Never leave impersonation-restore crumbs behind after a full sign-out
      // (e.g. signing out from settings while impersonating).
      await SecureStore.deleteItemAsync('imp_admin_token');
      await SecureStore.deleteItemAsync('imp_admin_refresh');
      await SecureStore.deleteItemAsync('imp_admin_user');
      set({ user: null, role: null, activeTeacherId: null, impersonation: null, isAuthenticated: false });
    },

    hydrate: async () => {
      try {
        const token = await SecureStore.getItemAsync('access_token');
        const sessionRaw = await SecureStore.getItemAsync(SESSION_KEY);
        if (token && sessionRaw) {
          const { user, activeTeacherId, impersonation } = JSON.parse(sessionRaw);
          // Re-derive role from user_type_id so sessions persisted under an older,
          // buggy resolver (e.g. a teacher saved as 'parent') self-heal on launch.
          set({ user, role: resolveRole(user), activeTeacherId: activeTeacherId ?? null, impersonation: impersonation ?? null, isAuthenticated: true });
        }
      } catch {
        set({ isAuthenticated: false });
      } finally {
        set({ isLoading: false });
      }
    },
  };
});
