import { useLocalSearchParams } from 'expo-router';
import { ThreadScreen } from '@/components/threads/ThreadScreen';

/**
 * A parent opens one حكاية from «مجتمعنا» (founder 2026-10-15). The student's and teacher's
 * screen: with `permissions.role === 'parent'` there is no composer and no vote, their child's
 * answer is highlighted, and the answer menu offers report / hide-my-child's.
 */
export default function ParentThreadRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <ThreadScreen threadId={parseInt(String(id ?? '0'), 10) || 0} />;
}
