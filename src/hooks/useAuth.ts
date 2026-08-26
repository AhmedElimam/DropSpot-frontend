import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, resolveRole } from '@/stores/authStore';
import {
  login as loginApi,
  register as registerApi,
  setParentPassword,
  deleteAccount,
  forgotPassword as forgotPasswordApi,
  resetPassword as resetPasswordApi,
  changePassword as changePasswordApi,
} from '@/api/auth';
import { acceptStudentInvite } from '@/api/invitation';

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const setTokens = useAuthStore((s) => s.setTokens);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: { phone_number: string; password: string }) =>
      loginApi(payload.phone_number, payload.password),
    onSuccess: async (data) => {
      // A new auth context must not inherit the previous session's cached data
      // (e.g. the admin impersonation user-list, keyed on a process-global client).
      qc.clear();
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
    mutationFn: (payload: { token: string; password: string; terms_accepted: boolean }) =>
      setParentPassword(payload.token, payload.password, payload.terms_accepted),
    onSuccess: async (data) => {
      const role = resolveRole(data.user);
      await setTokens(data.tokens.access_token, data.tokens.refresh_token);
      await setSession(data.user, role);
    },
  });
}

// §1 — Student-centric invite accept: set password via the invite token → the
// student becomes the primary app user and is logged straight in.
export function useAcceptInvite() {
  const setSession = useAuthStore((s) => s.setSession);
  const setTokens = useAuthStore((s) => s.setTokens);

  return useMutation({
    mutationFn: (payload: { token: string; password: string; name?: string }) =>
      acceptStudentInvite(payload.token, { password: payload.password, name: payload.name }),
    onSuccess: async (data) => {
      const role = resolveRole(data.user);
      await setTokens(data.tokens.access_token, data.tokens.refresh_token);
      await setSession(data.user, role);
    },
  });
}

// Forgot password — step 1: request the reset code by SMS.
export function useForgotPassword() {
  return useMutation({
    mutationFn: (phone_number: string) => forgotPasswordApi(phone_number),
  });
}

// Forgot password — step 2: verify code + set new password → logged-in session.
export function useResetPassword() {
  const setSession = useAuthStore((s) => s.setSession);
  const setTokens = useAuthStore((s) => s.setTokens);

  return useMutation({
    mutationFn: (payload: { phone_number: string; code: string; password: string }) =>
      resetPasswordApi(payload.phone_number, payload.code, payload.password),
    onSuccess: async (data) => {
      const role = resolveRole(data.user);
      await setTokens(data.tokens.access_token, data.tokens.refresh_token);
      await setSession(data.user, role);
    },
  });
}

// Change password while logged in.
export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: { current_password: string; password: string }) =>
      changePasswordApi(payload.current_password, payload.password),
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
      terms_accepted: boolean;
    }) => registerApi(payload),
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await logout();
      // Drop every cached query so the next session starts clean (prevents a stale
      // admin-scoped list, e.g. impersonation users, surviving into re-login).
      qc.clear();
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
