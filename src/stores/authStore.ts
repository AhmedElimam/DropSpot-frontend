import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@/types/user';

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
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const SESSION_KEY = 'session_data';

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
    isAuthenticated: false,
    isLoading: true,

    setSession: async (user, role) => {
      const { activeTeacherId, impersonation } = get();
      await persist(user, role, activeTeacherId, impersonation);
      set({ user, role, isAuthenticated: true });
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
      await SecureStore.setItemAsync('refresh_token', refresh);
    },

    logout: async () => {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      await SecureStore.deleteItemAsync(SESSION_KEY);
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
