import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMergeOptions,
  mergeCourses,
  type MergePayload,
  getOverrideOptions,
  createOverride,
  cancelOverride,
} from '@/api/scheduleTools';

export function useMergeOptions() {
  return useQuery({ queryKey: ['merge-options'], queryFn: getMergeOptions, staleTime: 15_000 });
}

export function useMergeCourses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: MergePayload) => mergeCourses(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merge-options'] });
      qc.invalidateQueries({ queryKey: ['teacher-courses'] });
      qc.invalidateQueries({ queryKey: ['teacher-session-history'] });
    },
  });
}

export function useOverrideOptions() {
  return useQuery({ queryKey: ['override-options'], queryFn: getOverrideOptions, staleTime: 15_000 });
}

export function useCreateOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { label?: string; start_date: string; end_date: string; items: { schedule_id: number; start_time: string }[] }) =>
      createOverride(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['override-options'] }),
  });
}

export function useCancelOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelOverride(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['override-options'] }),
  });
}
