import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/theme/index';
import { StudentProfile } from '@/components/teacher/StudentProfile';

/**
 * The student's full profile as a native sheet over the collections list (founder
 * 2026-10-06: the RN modal opened and closed clumsily). The stack presents it as an iOS form
 * sheet — native spring, grabber, swipe down to close, the list dimmed above it — and slides
 * it up on Android. Same component as the page, so nothing differs but the frame.
 *
 * Its own SafeAreaProvider measures the sheet, not the window: no status-bar gap in a card
 * that starts below the status bar.
 */
export default function StudentSheet() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StudentProfile id={id} sheet initialName={name} onClose={() => (router.canGoBack() ? router.back() : undefined)} />
      </View>
    </SafeAreaProvider>
  );
}
