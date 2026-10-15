import { useLocalSearchParams } from 'expo-router';
import { ChatRoomInfoScreen } from '@/components/chat/ChatRoomInfoScreen';

/** A course room's own page for a student: members (moderators flagged), the shelf, the calendar. */
export default function StudentChatInfoRoute() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();

  return <ChatRoomInfoScreen courseId={parseInt(String(courseId ?? '0'), 10) || 0} />;
}
