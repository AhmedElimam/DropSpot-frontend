import { useLocalSearchParams } from 'expo-router';
import { RemoteRoomScreen } from '@/components/remote/RemoteRoomScreen';
import { useAuthStore } from '@/stores/authStore';
import { Surface } from '@/ui/surfaces';

/** «حصة أونلاين» — the student watches their session's live class: `/(student)/remote/{sessionId}`. */
export default function StudentRemoteRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const studentId = useAuthStore((s) => s.user?.student_id ?? null);
  return (
    <Surface id="screen.student.remote.room" screen>
      <RemoteRoomScreen role="student" sessionId={String(id)} studentId={studentId} />
    </Surface>
  );
}
