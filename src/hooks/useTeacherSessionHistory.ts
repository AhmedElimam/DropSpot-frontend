import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTeacherSessions,
  getSessionDetail,
  markAttendance,
  cancelSession,
  restoreSession,
  recordNote,
  recordSheetGrade,
  toggleSheet,
  toggleSheetExcluded,
  updateSheetMaxMark,
  pauseSessions,
  type SessionDetail,
} from '@/api/teacherSessions';

export function useTeacherSessionHistory(status?: string) {
  return useQuery({
    queryKey: ['teacher-session-history', status ?? 'all'],
    queryFn: () => getTeacherSessions({ status: status || undefined }),
    staleTime: 30_000,
  });
}

export function useSessionDetail(id?: string) {
  return useQuery({
    queryKey: ['teacher-session-detail', id],
    queryFn: () => getSessionDetail(id!),
    enabled: !!id,
  });
}

/** Write the refreshed detail into cache and invalidate the history list. */
function useSyncSession(id?: string) {
  const qc = useQueryClient();
  return (fresh: SessionDetail) => {
    qc.setQueryData(['teacher-session-detail', id], fresh);
    qc.invalidateQueries({ queryKey: ['teacher-session-history'] });
  };
}

export function useSessionControls(id: string) {
  const sync = useSyncSession(id);

  const mark = useMutation({
    mutationFn: (v: { studentId: number; status: 'present' | 'late' | 'absent' | 'excused' }) =>
      markAttendance(id, v.studentId, v.status),
    onSuccess: sync,
  });
  const cancel = useMutation({ mutationFn: () => cancelSession(id), onSuccess: sync });
  const restore = useMutation({ mutationFn: () => restoreSession(id), onSuccess: sync });
  const note = useMutation({
    mutationFn: (v: { studentId: number; note: string }) => recordNote(id, v.studentId, v.note),
    onSuccess: sync,
  });
  const grade = useMutation({
    mutationFn: (v: { studentId: number; mark: number | null }) => recordSheetGrade(id, v.studentId, v.mark),
    onSuccess: sync,
  });
  const sheet = useMutation({ mutationFn: (studentId: number) => toggleSheet(id, studentId), onSuccess: sync });
  const sheetExcluded = useMutation({ mutationFn: () => toggleSheetExcluded(id), onSuccess: sync });
  const sheetMax = useMutation({ mutationFn: (max: number | null) => updateSheetMaxMark(id, max), onSuccess: sync });

  return { mark, cancel, restore, note, grade, sheet, sheetExcluded, sheetMax };
}

export function usePauseSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { from: string; to: string }) => pauseSessions(v.from, v.to),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-session-history'] }),
  });
}
