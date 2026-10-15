import { useLocalSearchParams } from 'expo-router';
import { ChatRoomInfoScreen } from '@/components/chat/ChatRoomInfoScreen';

/** A room's own page for a parent: who is in it, the shelf, the calendar. */
export default function ParentChatInfoRoute() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();

  return <ChatRoomInfoScreen courseId={parseInt(String(courseId ?? '0'), 10) || 0} />;
}
