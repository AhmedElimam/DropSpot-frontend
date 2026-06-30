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
  setSession: (user: User, role: UserRole) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,

  setSession: (user, role) => set({ user, role, isAuthenticated: true }),

  setTokens: async (access, refresh) => {
    await SecureStore.setItemAsync('access_token', access);
    await SecureStore.setItemAsync('refresh_token', refresh);
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ user: null, role: null, isAuthenticated: false });
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (token) set({ isAuthenticated: true });
    } catch {
      set({ isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
