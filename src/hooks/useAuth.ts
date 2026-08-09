import { useMutation } from '@tanstack/react-query';
import { useAuthStore, resolveRole } from '@/stores/authStore';
import { login as loginApi, register as registerApi, setParentPassword, deleteAccount } from '@/api/auth';

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const setTokens = useAuthStore((s) => s.setTokens);

  return useMutation({
    mutationFn: (payload: { phone_number: string; password: string }) =>
      loginApi(payload.phone_number, payload.password),
    onSuccess: async (data) => {
      // Role is derived from the authoritative user_type_id (teacher=3,
      // assistant=6, student=5), not the backend's top-level role (null for
      // teachers) — that mismatch was routing teachers into the parent app.
      const role = resolveRole(data.user);
      await setTokens(data.tokens.access_token, data.tokens.refresh_token);
      await setSession(data.user, role);
    },
  });
}

// First-time parent setup: set password via token → logged-in session.
export function useParentSetup() {
  const setSession = useAuthStore((s) => s.setSession);
  const setTokens = useAuthStore((s) => s.setTokens);

  return useMutation({
    mutationFn: (payload: { token: string; password: string }) =>
      setParentPassword(payload.token, payload.password),
    onSuccess: async (data) => {
      const role = resolveRole(data.user);
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

// Account deletion (Apple 5.1.1(v)): ask the server to block the account, then
// clear the local session so the guards route back to login.
export function useDeleteAccount() {
  const logout = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: async () => {
      await deleteAccount();
      await logout();
    },
  });
}
