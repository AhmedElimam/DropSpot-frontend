import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTickets, getTicket, getStudentTeachers, addMessage, updateTicketStatus } from '@/api/tickets';

export function useTickets() {
  return useQuery({ queryKey: ['tickets'], queryFn: getTickets });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['tickets', id],
    queryFn: () => getTicket(id),
    enabled: !!id,
  });
}

export function useStudentTeachers(studentId: number | null) {
  return useQuery({
    queryKey: ['student-teachers', studentId],
    queryFn: () => getStudentTeachers(studentId!),
    enabled: !!studentId,
  });
}

export function useAddMessage(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => addMessage(ticketId, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', ticketId] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useUpdateTicketStatus(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: string) => updateTicketStatus(ticketId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', ticketId] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}
