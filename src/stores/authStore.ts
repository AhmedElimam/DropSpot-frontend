import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@/types/user';

export type UserRole = 'student' | 'parent';

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
        const { user, role } = JSON.parse(sessionRaw);
        set({ user, role, isAuthenticated: true });
      } else if (token) {
        set({ isAuthenticated: true });
      }
    } catch {
      set({ isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
