import { useMutation } from '@tanstack/react-query';
import { useAuthStore, type UserRole } from '@/stores/authStore';
import { login as loginApi } from '@/api/auth';

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const setTokens = useAuthStore((s) => s.setTokens);

  return useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      loginApi(payload.email, payload.password),
    onSuccess: async (data) => {
      const role: UserRole = data.role ?? (data.user?.student_id ? 'student' : 'parent');
      await setTokens(data.tokens.access_token, data.tokens.refresh_token);
      await setSession(data.user, role);
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: async () => {
      await logout();
    },
  });
}
