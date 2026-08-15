import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return null;
  }

  // Single source of role routing: hand authenticated users to app/index.tsx,
  // which redirects by role (teacher/assistant/student/parent). Duplicating that
  // logic here is exactly what sent a freshly-logged-in teacher to /(parent) —
  // the two copies drifted, and only a reload (routing through index) fixed it.
  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}