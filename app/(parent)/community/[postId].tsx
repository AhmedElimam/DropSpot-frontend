import { useLocalSearchParams } from 'expo-router';
import { CommunityPostScreen } from '@/components/community/CommunityPostScreen';
import { Surface } from '@/ui/surfaces';

/** One «مجتمعنا» post in the parents' space — pushed over the tabs. */
export default function ParentCommunityPost() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  return (
    <Surface id="screen.parent.community_post" screen>
      <CommunityPostScreen postId={Number(postId)} />
    </Surface>
  );
}
