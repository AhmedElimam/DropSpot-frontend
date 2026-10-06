import { Modal, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '@/theme/index';
import { StudentProfile } from '@/components/teacher/StudentProfile';

/**
 * The student's full profile over the page you are on (founder 2026-10-06: tapping a student
 * on the collections list shows the same details page — corrections, paid-before-joining,
 * past attendance, collecting — in a modal). On iOS a page sheet: the list stays peeking
 * above it and a swipe down closes it.
 *
 * Its own SafeAreaProvider measures the sheet, not the screen, so the hero does not leave a
 * status-bar gap inside a card that starts below the status bar. The profile's own sheets
 * (collect, correct, backfill…) open on top of it and keep their keyboard handling.
 */
export function StudentProfileModal({ studentId, onClose }: { studentId: number | null; onClose: () => void }) {
  return (
    <Modal
      visible={studentId != null}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            {studentId != null ? <StudentProfile id={String(studentId)} onClose={onClose} /> : null}
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}
