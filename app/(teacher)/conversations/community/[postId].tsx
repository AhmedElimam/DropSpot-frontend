import { useLocalSearchParams } from 'expo-router';
import { CommunityPostScreen } from '@/components/community/CommunityPostScreen';
import { Surface } from '@/ui/surfaces';

/** One «مجتمعنا» post, as the teacher or a granted assistant sees it. */
export default function TeacherCommunityPost() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  return (
    <Surface id="screen.teacher.community_post" screen>
      <CommunityPostScreen postId={Number(postId)} />
    </Surface>
  );
}
