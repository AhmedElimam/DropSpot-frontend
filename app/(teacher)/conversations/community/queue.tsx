import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { CommunityQueueScreen } from '@/components/community/CommunityQueueScreen';
import { Surface } from '@/ui/surfaces';

/** The moderators' queue (held, flagged, reports) for one teacher's community. */
export default function TeacherCommunityQueue() {
  const { teacher } = useLocalSearchParams<{ teacher?: string }>();
  const me = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const active = useAuthStore((s) => s.activeTeacherId);
  const teacherId = Number(teacher) || (role === 'assistant' ? active ?? 0 : me?.id ?? 0);
  return (
    <Surface id="screen.teacher.community_queue" screen>
      <CommunityQueueScreen teacherId={teacherId} />
    </Surface>
  );
}
