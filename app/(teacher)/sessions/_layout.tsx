import { Stack } from 'expo-router';
import { colors } from '@/theme/index';

/** الحصص — today's sessions + history, and the attendance sheet of one session. */
export default function TeacherSessionsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
