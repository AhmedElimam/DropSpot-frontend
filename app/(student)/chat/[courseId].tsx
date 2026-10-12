import { useLocalSearchParams } from 'expo-router';
import { ChatRoomScreen } from '@/components/chat/ChatRoomScreen';

/** The student's entry into a course room. The room itself is role-aware — see ChatRoomScreen. */
export default function StudentChatRoomRoute() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();

  const id = parseInt(String(courseId ?? '0'), 10) || 0;

  return <ChatRoomScreen courseId={id} infoHref={`/(student)/chat/info/${id}`} />;
}
