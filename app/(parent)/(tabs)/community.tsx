import { CommunityComingSoon } from '@/components/parent/CommunityComingSoon';
import { ParentRooms } from '@/components/parent/ParentRooms';
import { useChatEnabled } from '@/hooks/useChat';
import { Surface } from '@/ui/surfaces';

/**
 * «مجتمعنا» — the parent's centre tab (founder 2026-10-06): the child's course chat and a parents'
 * chat per course. The rooms themselves once the chat is on (2026-10-12); until then the
 * coming-soon preview. «أبنائي» moved to a stack screen opened from Home's children section.
 */
export default function ParentCommunity() {
  const chatEnabled = useChatEnabled();
  return <Surface id="screen.parent.community" screen>{chatEnabled ? <ParentRooms /> : <CommunityComingSoon />}</Surface>;
}
