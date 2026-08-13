import { Redirect, type Href } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // A super-admin / admin has no normal app — only the impersonation picker.
  if (role === 'admin') return <Redirect href={'/(admin)/impersonate' as Href} />;
  // Teachers and their assistants share the teacher app (assistant access is
  // reduced by role checks inside it).
  if (role === 'teacher' || role === 'assistant') return <Redirect href="/(teacher)" />;
  return <Redirect href={role === 'student' ? '/(student)' : '/(parent)'} />;
}