import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCheckinPermissions,
  getBillingOverrides,
  revokeCheckinPermission,
  grantBillingOverride,
  revokeBillingOverride,
} from '@/api/teacher';

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
