import { useMutation } from '@tanstack/react-query';
import { useAuthStore, type UserRole } from '@/stores/authStore';
import { router } from 'expo-router';
import type { User } from '@/types/user';

const MOCK_USERS: Record<string, { user: User; role: UserRole; route: string }> = {
  'student@drosspot.com': {
    user: { id: 1, user_type_id: 2, name: 'يوسف أحمد', email: 'student@drosspot.com', phone: null, email_verified_at: new Date().toISOString(), created_at: new Date().toISOString() },
    role: 'student',
    route: '/(student)',
  },
  'parent@drosspot.com': {
    user: { id: 2, user_type_id: 3, name: 'أحمد علي', email: 'parent@drosspot.com', phone: null, email_verified_at: new Date().toISOString(), created_at: new Date().toISOString() },
    role: 'parent',
    route: '/(parent)',
  },
};

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const setTokens = useAuthStore((s) => s.setTokens);

  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      await new Promise((r) => setTimeout(r, 800));
      const mock = MOCK_USERS[payload.email.toLowerCase()];
      if (!mock || payload.password !== 'password') throw new Error('Invalid credentials');
      return mock;
    },
    onSuccess: async (data) => {
      setSession(data.user, data.role);
      await setTokens(`mock-${data.role}-token`, `mock-${data.role}-refresh`);
      router.replace(data.route as any);
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: async () => {
      await logout();
      router.replace('/(auth)/login');
    },
  });
}
