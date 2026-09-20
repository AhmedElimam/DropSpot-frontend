import { useLocalSearchParams } from 'expo-router';
import { ThreadScreen } from '@/components/threads/ThreadScreen';

/** A student opens one question thread from the Threads segment. Same screen as the teacher's. */
export default function StudentThreadRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <ThreadScreen threadId={parseInt(String(id ?? '0'), 10) || 0} />;
}
