import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Teachers and their assistants share the teacher app (assistant access is
  // reduced by role checks inside it).
  if (role === 'teacher' || role === 'assistant') return <Redirect href="/(teacher)" />;
  return <Redirect href={role === 'student' ? '/(student)' : '/(parent)'} />;
}