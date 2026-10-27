import { useLocalSearchParams } from 'expo-router';
import { CommunityPostScreen } from '@/components/community/CommunityPostScreen';
import { Surface } from '@/ui/surfaces';

/** One «مجتمعنا» post — pushed over the tabs (edge swipe back). */
export default function StudentCommunityPost() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  return (
    <Surface id="screen.student.community_post" screen>
      <CommunityPostScreen postId={Number(postId)} />
    </Surface>
  );
}
