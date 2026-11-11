import { useInfiniteQuery } from '@tanstack/react-query';
import { getFamilyHomework, getMyHomework } from '@/api/homework';

/**
 * The family's homework, page by page (newest first) with the rate over all of it. A parent
 * may narrow to one child; a student reads their own. Grades land at the next session:
 * five minutes fresh is plenty.
 */
export function useHomework(who: 'parent' | 'student', studentId?: string | null) {
  return useInfiniteQuery({
    queryKey: ['homework', who, studentId ?? 'all'],
    queryFn: ({ pageParam }) => (who === 'parent'
      ? getFamilyHomework({ studentId, page: pageParam })
      : getMyHomework({ page: pageParam })),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
    staleTime: 5 * 60_000,
  });
}
