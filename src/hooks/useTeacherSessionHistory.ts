import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useOfflineStore } from '@/stores/offlineStore';
import { useAuthStore, stampTeacherId } from '@/stores/authStore';
import { queueMark, getPendingMarksForSession } from '@/db/offlineMarks';
import { applyPendingMarks, isNetworkFailure } from '@/db/marksSync';
import { cacheSessionDetail, readCachedSessionDetail } from '@/db/sessionDetailCache';
import { triggerAutoSync } from '@/db/autoSync';
import { uuid } from '@/utils/uuid';
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
  setSessionType,
  pauseSessions,
  type SessionDetail,
} from '@/api/teacherSessions';

export function useTeacherSessionHistory(status?: string) {
  return useQuery({
    queryKey: ['teacher-session-history', status ?? 'all'],
    queryFn: () => getTeacherSessions({ status: status || undefined }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * The session's roster. Online: the server's answer, written through to the phone's
 * last-known copy. Offline (the request never reaches the server): that copy, flagged
 * `offline`, so the sheet still opens and marks can be queued. Either way the marks still
 * waiting in the offline queue are laid over the picture, so what the teacher tapped is
 * what the teacher sees until the sync confirms it.
 */
/** Every session in a date window (inclusive YYYY-MM-DD) — the Sessions tab's week strip. */
export function useTeacherSessionsWindow(from: string, to: string) {
  return useQuery({
    queryKey: ['teacher-session-history', 'window', from, to],
    queryFn: () => getTeacherSessions({ from, to }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useSessionDetail(id?: string) {
  return useQuery({
    queryKey: ['teacher-session-detail', id],
    queryFn: async (): Promise<SessionDetail> => {
      let detail: SessionDetail;
      try {
        detail = await getSessionDetail(id!);
        void cacheSessionDetail(id!, detail);
      } catch (e) {
        if (!isNetworkFailure(e)) throw e;
        const cached = await readCachedSessionDetail(id!);
        if (!cached) throw e;
        detail = { ...cached.detail, offline: true, cached_at: new Date(cached.at).toISOString() };
      }
      const pending = await getPendingMarksForSession(Number(id)).catch(() => []);
      return applyPendingMarks(detail, pending);
    },
    enabled: !!id,
    // A cached answer is a real answer here; no point hammering a dead radio.
    retry: (count, error) => !isNetworkFailure(error) && count < 2,
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

  const qc = useQueryClient();
  const mark = useMutation({
    mutationFn: async (v: { studentId: number; status: 'present' | 'late' | 'absent' | 'excused' }): Promise<SessionDetail> => {
      const online = useOfflineStore.getState().online;
      if (online) {
        try {
          return await markAttendance(id, v.studentId, v.status);
        } catch (e) {
          if (!isNetworkFailure(e)) throw e; // a server verdict (not enrolled, no allowance…) is shown, not queued
        }
      }
      // No signal: queue the intent on this phone and show it as done-pending. The replay
      // (autoSync) delivers it with the moment it was made; the server refuses it only if
      // something newer landed meanwhile.
      const current = qc.getQueryData<SessionDetail>(['teacher-session-detail', id]) ?? (await readCachedSessionDetail(id))?.detail;
      const who = current?.attendees.find((a) => a.student_id === v.studentId) ?? current?.swap_ins?.find((a) => a.student_id === v.studentId);
      await queueMark({
        client_uuid: uuid(),
        session_instance_id: Number(id),
        student_id: v.studentId,
        status: v.status,
        marked_at: new Date().toISOString(),
        teacher_id: stampTeacherId(useAuthStore.getState()),
        student_name: who?.name ?? null,
        course_name: current?.course_name ?? null,
      });
      void useOfflineStore.getState().refresh();
      void triggerAutoSync();
      if (!current) throw new Error('OFFLINE_QUEUED');
      const pending = await getPendingMarksForSession(Number(id));
      return applyPendingMarks({ ...current, offline: current.offline ?? !online }, pending);
    },
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
  const setType = useMutation({ mutationFn: (type: 'normal_sheet' | 'quiz_exam') => setSessionType(id, type), onSuccess: sync });

  return { mark, cancel, restore, note, grade, sheet, sheetExcluded, sheetMax, setType };
}

export function usePauseSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { from: string; to: string }) => pauseSessions(v.from, v.to),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-session-history'] }),
  });
}
