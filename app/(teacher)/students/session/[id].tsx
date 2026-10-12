import { Redirect, useLocalSearchParams } from 'expo-router';
import { Surface } from '@/ui/surfaces';

/**
 * The attendance sheet used to live under the Students tab (founder 2026-10-02: "position
 * on the students tab isn't right"). It is now /(teacher)/sessions/[id]; this stub keeps
 * old deep links and already-queued notifications working.
 */
export default function LegacySessionRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Surface id="screen.teacher.students.session" screen>
      <Redirect href={`/(teacher)/sessions/${id}` as never} />
    </Surface>
  );
}
