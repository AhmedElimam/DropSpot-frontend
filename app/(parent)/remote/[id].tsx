import { useLocalSearchParams } from 'expo-router';
import { RemoteRoomScreen } from '@/components/remote/RemoteRoomScreen';
import { Surface } from '@/ui/surfaces';

/**
 * «حصة أونلاين» — a parent watches a child's live class:
 * `/(parent)/remote/{sessionId}?student_id={the child's student id}`. The server checks the
 * child is theirs and enrolled; a missing or malformed id opens nothing but the error state.
 */
export default function ParentRemoteRoom() {
  const { id, student_id } = useLocalSearchParams<{ id: string; student_id?: string }>();
  const studentId = /^\d+$/.test(String(student_id ?? '')) ? Number(student_id) : null;
  return (
    <Surface id="screen.parent.remote.room" screen>
      <RemoteRoomScreen role="parent" sessionId={String(id)} studentId={studentId} />
    </Surface>
  );
}
