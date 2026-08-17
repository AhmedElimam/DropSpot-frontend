import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSchedule, type CreateSchedulePayload } from '@/api/schedules';

/**
 * Create a weekly schedule slot. On success, invalidate the session history and
 * course caches so the newly generated sessions surface without a manual refresh.
 */
export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSchedulePayload) => createSchedule(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-session-history'] });
      qc.invalidateQueries({ queryKey: ['teacher-courses'] });
    },
  });
}
