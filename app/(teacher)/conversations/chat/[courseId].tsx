import { useLocalSearchParams } from 'expo-router';
import { ChatRoomScreen } from '@/components/chat/ChatRoomScreen';

/**
 * The teacher's entry into a course room, from the Chat segment of the Conversations tab.
 *
 * Same screen as the student's: the room payload says `role`, and the moderator controls
 * (hidden text, remove, mute, the report queue, lock / announcements) appear from that. One
 * room, one screen — two copies would be two places for the safety rules to drift.
 */
export default function TeacherChatRoomRoute() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();

  return <ChatRoomScreen courseId={parseInt(String(courseId ?? '0'), 10) || 0} />;
}
