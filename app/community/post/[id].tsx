import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { ROUTE_BY_ROLE } from '@/utils/routes';

/**
 * Where `drosspot://community/post/{id}` lands — «افتح في التطبيق» on a shared post's public page
 * (drosspot.app/c/…, founder 2026-10-29). The post lives under each role's own stack, so this
 * only forwards: the post screen then asks the server, which answers 403/404 to anyone the post
 * is not for (a parent opening a students'-community link, a post since hidden).
 */
export default function CommunityPostDeepLink() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const postId = Number(id);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!Number.isInteger(postId) || postId <= 0) {
    return <Redirect href={ROUTE_BY_ROLE} />;
  }
  if (role === 'student') return <Redirect href={`/(student)/community/${postId}` as Href} />;
  if (role === 'parent') return <Redirect href={`/(parent)/community/${postId}` as Href} />;
  if (role === 'teacher') return <Redirect href={`/(teacher)/conversations/community/${postId}` as Href} />;

  // An assistant has no community; anyone else goes home through the role router (every gate re-applied).
  return <Redirect href={ROUTE_BY_ROLE} />;
}
