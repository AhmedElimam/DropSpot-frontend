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

  // Terms gate (teacher first app open + anyone grandfathered / hit by a version
  // bump). Student/parent primarily accept inline at registration/setup, so a fresh
  // account clears this before it ever reaches here; this is the universal net.
  if (user?.must_accept_terms) {
    return <Redirect href={'/accept-terms' as Href} />;
  }

  // Self-registration wall: a student who signed up on their own can't use the app
  // until a subscribed teacher has enrolled them. Clears once an enrollment exists.
  if (role === 'student' && user?.needs_teacher_invitation) {
    return <Redirect href={'/needs-teacher' as Href} />;
  }

  // Student deferred gate: their OWN number was never verified at registration and the
  // daily sweep has now flagged it — hard-block until they OTP-verify it.
  if (role === 'student' && user?.needs_own_number_verification) {
    return <Redirect href={'/verify-own-number' as Href} />;
  }

  // A super-admin / admin has no normal app — only the impersonation picker.
  if (role === 'admin') return <Redirect href={'/(admin)/impersonate' as Href} />;
  // Teachers and their assistants share the teacher app (assistant access is
  // reduced by role checks inside it).
  if (role === 'teacher' || role === 'assistant') return <Redirect href="/(teacher)" />;
  return <Redirect href={role === 'student' ? '/(student)' : '/(parent)'} />;
}