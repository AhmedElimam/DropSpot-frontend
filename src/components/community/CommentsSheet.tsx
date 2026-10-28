import { useWindowDimensions } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import type { CommunityAudience, CommunityRole } from '@/api/community';
import { CommentsPanel } from './CommentsPanel';

/**
 * The comments first open here, over the feed (founder 2026-10-28): the first page and the
 * composer; «عرض كل التعليقات» goes on to the post page. A picture's thread opens the same sheet
 * inside the photo viewer (wrapped in an InlineSheetHost there: never a second native window).
 */
export function CommentsSheet({ visible, postId, audience, mediaId = null, role, total, onClose, onViewAll }: {
  visible: boolean;
  postId: number;
  audience: CommunityAudience;
  mediaId?: number | null;
  role: CommunityRole;
  total: number;
  onClose: () => void;
  onViewAll?: () => void;
}) {
  const { height } = useWindowDimensions();
  return (
    <SheetModal visible={visible} onClose={onClose}>
      {visible ? <CommentsPanel postId={postId} audience={audience} mediaId={mediaId} role={role} total={total} height={Math.round(height * 0.68)} onViewAll={onViewAll} /> : null}
    </SheetModal>
  );
}
