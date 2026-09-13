import { useLocalSearchParams } from 'expo-router';
import { ChatRoomScreen } from '@/components/chat/ChatRoomScreen';

/** The student's entry into a course room. The room itself is role-aware — see ChatRoomScreen. */
export default function StudentChatRoomRoute() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();

  return <ChatRoomScreen courseId={parseInt(String(courseId ?? '0'), 10) || 0} />;
}
