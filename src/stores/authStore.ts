import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@/types/user';

export type UserRole = 'student' | 'parent' | 'teacher' | 'assistant';

/**
 * Single source of truth for role. Derived from the authoritative `user_type_id`
 * (3=teacher, 6=assistant, 5/has-student=student, else parent), numeric-safe in
 * case the API serializes the id as a string. We intentionally do NOT trust the
 * backend's top-level `role` (null for teachers) or the appended `user.role`
 * ('tutor' for teachers) — both have led to teachers landing in the parent app.
 */
export function resolveRole(user: { user_type_id?: number | string | null; student_id?: number | null } | null | undefined): UserRole {
  const t = Number(user?.user_type_id);
  if (t === 3) return 'teacher';
  if (t === 6) return 'assistant';
  if (t === 5 || user?.student_id) return 'student';
  return 'parent';
}

interface AuthState {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setTokens: (access: string, refresh: string) => Promise<void>;
  setSession: (user: User, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const SESSION_KEY = 'session_data';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,

  setSession: async (user, role) => {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ user, role }));
    set({ user, role, isAuthenticated: true });
  },

  setTokens: async (access, refresh) => {
    await SecureStore.setItemAsync('access_token', access);
    await SecureStore.setItemAsync('refresh_token', refresh);
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync(SESSION_KEY);
    set({ user: null, role: null, isAuthenticated: false });
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const sessionRaw = await SecureStore.getItemAsync(SESSION_KEY);
      if (token && sessionRaw) {
        const { user } = JSON.parse(sessionRaw);
        // Re-derive role from user_type_id so sessions persisted under an older,
        // buggy resolver (e.g. a teacher saved as 'parent') self-heal on launch.
        set({ user, role: resolveRole(user), isAuthenticated: true });
      }
    } catch {
      set({ isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
