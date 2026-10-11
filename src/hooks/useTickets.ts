import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTickets, getTicket, getStudentTeachers, addMessage, sendStudentReport, updateTicketStatus, type PendingFile } from '@/api/tickets';

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
    // NOT 'student-teachers': that key holds the overview shape (api/studentOverview); two
    // fetchers on one key would hand each other the wrong data.
    queryKey: ['ticket-teachers', studentId],
    queryFn: () => getStudentTeachers(studentId!),
    enabled: !!studentId,
  });
}

export function useAddMessage(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: string | { message: string; files?: PendingFile[] }) =>
      typeof v === 'string' ? addMessage(ticketId, v) : addMessage(ticketId, v.message, v.files ?? []),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', ticketId] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useSendStudentReport(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => sendStudentReport(ticketId),
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
