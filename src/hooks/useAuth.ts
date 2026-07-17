import { useMutation } from '@tanstack/react-query';
import { useAuthStore, type UserRole } from '@/stores/authStore';
import { login as loginApi, register as registerApi } from '@/api/auth';

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const setTokens = useAuthStore((s) => s.setTokens);

  return useMutation({
    mutationFn: (payload: { phone_number: string; password: string }) =>
      loginApi(payload.phone_number, payload.password),
    onSuccess: async (data) => {
      // user_type_id 3 = teacher (in-app scan mode); otherwise student (has a
      // student_id) or parent. Backend-provided data.role wins when present.
      const role: UserRole =
        data.role ??
        (data.user?.user_type_id === 3
          ? 'teacher'
          : data.user?.student_id
            ? 'student'
            : 'parent');
      await setTokens(data.tokens.access_token, data.tokens.refresh_token);
      await setSession(data.user, role);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (payload: {
      name: string;
      phone_number: string;
      password: string;
      parent_phone: string;
      parent_relation: string;
      parent_name: string;
    }) => registerApi(payload),
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
