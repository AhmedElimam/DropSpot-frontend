import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { ROUTE_BY_ROLE } from '@/utils/routes';
import { gradients } from '@/theme/index';

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
    return <Redirect href={ROUTE_BY_ROLE} />;
  }

  // The auth screens sit on the deep gradient, so the scene behind a swipe-back is its top
  // colour — not the light canvas (dark mode showed a white sheet under the page).
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: gradients.auth[0] } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}