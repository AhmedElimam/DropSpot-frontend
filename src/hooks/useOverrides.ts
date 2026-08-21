import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCheckinPermissions,
  getBillingOverrides,
  revokeCheckinPermission,
  grantBillingOverride,
  revokeBillingOverride,
} from '@/api/teacher';
import { getAllowanceSetting, setAllowanceSetting, setStudentAllowanceBlock } from '@/api/allowance';

export function useCheckinPermissions() {
  return useQuery({ queryKey: ['checkin-permissions'], queryFn: getCheckinPermissions, staleTime: 30_000 });
}

export function useBillingOverrides() {
  return useQuery({ queryKey: ['billing-overrides'], queryFn: getBillingOverrides, staleTime: 30_000 });
}

export function useRevokeCheckinPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => revokeCheckinPermission(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkin-permissions'] }),
  });
}

export function useGrantBillingOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { student_id: number; reason?: string }) => grantBillingOverride(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-overrides'] }),
  });
}

export function useRevokeBillingOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => revokeBillingOverride(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-overrides'] }),
  });
}

/** Teacher-wide 15-day-allowance switch. */
export function useAllowanceSetting() {
  return useQuery({ queryKey: ['allowance-setting'], queryFn: getAllowanceSetting, staleTime: 60_000 });
}

export function useSetAllowanceSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => setAllowanceSetting(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allowance-setting'] }),
  });
}

/** Per-student block on the 15-day allowance. */
export function useSetStudentAllowanceBlock(studentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blocked: boolean) => setStudentAllowanceBlock(studentId, blocked),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-student', String(studentId)] }),
  });
}
