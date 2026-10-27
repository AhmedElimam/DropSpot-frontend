import { useInfiniteQuery } from '@tanstack/react-query';
import { getFamilySessionNotes, getMySessionNotes } from '@/api/sessionNotes';

/**
 * The family's session notes, page by page (newest session first). A parent may narrow to
 * one child; a student reads their own. Notes change rarely: five minutes fresh.
 */
export function useSessionNotes(who: 'parent' | 'student', studentId?: string | null) {
  return useInfiniteQuery({
    queryKey: ['session-notes', who, studentId ?? 'all'],
    queryFn: ({ pageParam }) => (who === 'parent'
      ? getFamilySessionNotes({ studentId, page: pageParam })
      : getMySessionNotes({ page: pageParam })),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
    staleTime: 5 * 60_000,
  });
}
