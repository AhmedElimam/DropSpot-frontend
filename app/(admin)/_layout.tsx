import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

/**
 * The super-admin's area (the impersonation picker). Signed out → login; any other role
 * (an impersonation in progress, a different account) → `/`, which routes by role. It
 * had no guard at all, so a sign-out from here left the picker on screen.
 */
export default function AdminLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const role = useAuthStore((s) => s.role);

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (role && role !== 'admin') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
