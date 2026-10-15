import { useLocalSearchParams } from 'expo-router';
import { ChatRoomInfoScreen } from '@/components/chat/ChatRoomInfoScreen';

/** A course room's own page for the teacher (or a granted assistant): members, moderation, the shelf. */
export default function TeacherChatInfoRoute() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();

  return <ChatRoomInfoScreen courseId={parseInt(String(courseId ?? '0'), 10) || 0} />;
}
