import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAssistants,
  inviteAssistant,
  createAssistant,
  updateAssistantAbilities,
  toggleAssistant,
  setAssistantVenueScope,
  removeAssistant,
} from '@/api/assistants';

export function useAssistants() {
  return useQuery({ queryKey: ['assistants'], queryFn: getAssistants, staleTime: 30_000 });
}

export function useInviteAssistant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inviteAssistant,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assistants'] }),
  });
}

export function useCreateAssistant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAssistant,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assistants'] }),
  });
}

export function useUpdateAbilities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, abilities }: { id: number; abilities: string[] }) => updateAssistantAbilities(id, abilities),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assistants'] }),
  });
}

export function useSetVenueScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, allVenues, venues }: { id: number; allVenues: boolean; venues?: number[] }) =>
      setAssistantVenueScope(id, allVenues, venues ?? []),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assistants'] }),
  });
}

export function useToggleAssistant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => toggleAssistant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assistants'] }),
  });
}

export function useRemoveAssistant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => removeAssistant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assistants'] }),
  });
}
