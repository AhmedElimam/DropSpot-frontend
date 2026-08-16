import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyTeachers, switchActiveTeacher } from '@/api/teacher';
import { useAuthStore } from '@/stores/authStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { syncScheduleCacheOnOpen } from '@/db/scheduleCache';

/**
 * The teachers an assistant works for + which context is active. Only assistants
 * have this; a plain teacher never calls it (the endpoint is assistant-scoped).
 */
export function useMyTeachers() {
  const role = useAuthStore((s) => s.role);
  return useQuery({
    queryKey: ['my-teachers'],
    queryFn: getMyTeachers,
    enabled: role === 'assistant',
    staleTime: 60_000,
  });
}

/**
 * Switch the active teacher context on the current token. On success we stamp the
 * new active id into the auth store (so offline scans stamp the right teacher) and
 * invalidate ALL cached queries — every teacher-scoped surface (roster, sessions,
 * tickets, overrides, abilities) must re-fetch for the new context, never carry
 * stale data from the previous teacher.
 */
export function useSwitchTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teacherId: number) => switchActiveTeacher(teacherId),
    onSuccess: (res) => {
      useAuthStore.getState().setActiveTeacherId(res.active_teacher_id);
      qc.invalidateQueries();
      // Add/refresh the newly-active teacher's OWN cache entry (keyed by that
      // teacher_id) — never evicts the previous teacher's still-buffered roster, so
      // their earlier scans still grade-check correctly. Fire-and-forget.
      syncScheduleCacheOnOpen(useOfflineStore.getState().online, res.active_teacher_id);
    },
  });
}
