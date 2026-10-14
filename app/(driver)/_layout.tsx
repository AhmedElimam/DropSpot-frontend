import { Stack } from 'expo-router';
import { colors } from '@/theme/index';

/** The driver mode: its own small stack, no tabs — a rider needs the trip, not a dashboard. */
export default function DriverLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, freezeOnBlur: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_left' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
