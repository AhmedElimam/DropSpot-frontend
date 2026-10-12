import { router, type Href } from 'expo-router';
import { CommunityComingSoon } from '@/components/parent/CommunityComingSoon';
import { ChatInbox } from '@/components/chat/ChatInbox';
import { useChatEnabled } from '@/hooks/useChat';
import { Surface } from '@/ui/surfaces';

/**
 * «مجتمعنا» — the parent's centre tab (founder 2026-10-06): the child's course chat and a parents'
 * chat per course. The rooms themselves once the chat is on (2026-10-12) — one card per course
 * with its parents' room and the child's room the parent follows; until then the coming-soon
 * preview. «أبنائي» moved to a stack screen opened from Home's children section.
 */
export default function ParentCommunity() {
  const chatEnabled = useChatEnabled();
  return (
    <Surface id="screen.parent.community" screen>
      {chatEnabled
        ? <ChatInbox role="parent" onOpen={(room) => router.push(`/(parent)/chat/${room}` as Href)} />
        : <CommunityComingSoon />}
    </Surface>
  );
}
