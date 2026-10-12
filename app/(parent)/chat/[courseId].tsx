import { useLocalSearchParams } from 'expo-router';
import { ChatRoomScreen } from '@/components/chat/ChatRoomScreen';

/**
 * A parent's room: a child's course room (followed, reading only) or the course's parents'
 * room — the id says which (src/chat/room.ts: minus the course id for the parents' room).
 * The room itself is role-aware — see ChatRoomScreen.
 */
export default function ParentChatRoomRoute() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();

  const id = parseInt(String(courseId ?? '0'), 10) || 0;

  return <ChatRoomScreen courseId={id} infoHref={`/(parent)/chat/info/${id}`} />;
}
