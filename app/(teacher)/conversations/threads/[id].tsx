import { useLocalSearchParams } from 'expo-router';
import { ThreadScreen } from '@/components/threads/ThreadScreen';

/**
 * The teacher's entry into one thread, from the Threads segment of the Conversations tab.
 * Same screen as the student's: the payload says `permissions`, and lock / extend / answer /
 * pick / hide appear from that.
 */
export default function TeacherThreadRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <ThreadScreen threadId={parseInt(String(id ?? '0'), 10) || 0} />;
}
