import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * The attendance sheet used to live under the Students tab (founder 2026-10-02: "position
 * on the students tab isn't right"). It is now /(teacher)/sessions/[id]; this stub keeps
 * old deep links and already-queued notifications working.
 */
export default function LegacySessionRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/(teacher)/sessions/${id}` as never} />;
}
