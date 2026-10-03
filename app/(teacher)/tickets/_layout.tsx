import { Stack } from 'expo-router';
import { colors } from '@/theme/index';

export default function TeacherTicketsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
