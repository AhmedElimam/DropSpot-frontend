import { useLocalSearchParams } from 'expo-router';
import { RemoteRoomScreen } from '@/components/remote/RemoteRoomScreen';
import { Surface } from '@/ui/surfaces';

/**
 * «حصة أونلاين» — the teacher's room: `/(teacher)/remote/{sessionId}`. Opened by
 * useTeacherRemote (start / enter), after the 1.3.0 gate and the camera + microphone
 * questions. The session's own teacher only — the server refuses an assistant.
 */
export default function TeacherRemoteRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Surface id="screen.teacher.remote.room" screen assistantNeeds="teacher">
      <RemoteRoomScreen role="teacher" sessionId={String(id)} />
    </Surface>
  );
}
