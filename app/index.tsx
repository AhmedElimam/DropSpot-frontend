import { Redirect, type Href } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Teacher first login: force setting their own password before entering the app.
  if (role === 'teacher' && user?.must_set_password) {
    return <Redirect href={'/change-password?forced=1' as Href} />;
  }

  // A super-admin / admin has no normal app — only the impersonation picker.
  if (role === 'admin') return <Redirect href={'/(admin)/impersonate' as Href} />;
  // Teachers and their assistants share the teacher app (assistant access is
  // reduced by role checks inside it).
  if (role === 'teacher' || role === 'assistant') return <Redirect href="/(teacher)" />;
  return <Redirect href={role === 'student' ? '/(student)' : '/(parent)'} />;
}