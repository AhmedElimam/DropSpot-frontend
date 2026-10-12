import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import {
  approveComplaint, fileComplaint, fileGradeComplaint, getComplaints, getFamilyComplaints, getMyComplaints, rejectComplaint, reviewComplaint,
  type ApproveInput, type Complaint, type ComplaintBucket,
} from '@/api/complaints';

// ---- student / parent ----

/**
 * The complaints this reader can see — a student's own, or every one on a parent's
 * children — plus quick lookups by session and by invoice (both ids are global, so one
 * map serves all of a parent's children).
 */
export function useMyComplaints(enabled = true) {
  const role = useAuthStore((s) => s.role);
  const q = useQuery({
    queryKey: ['my-complaints', role],
    queryFn: role === 'parent' ? getFamilyComplaints : getMyComplaints,
    enabled: enabled && (role === 'student' || role === 'parent'),
    staleTime: 30_000,
  });
  const bySession = useMemo(() => {
    const m = new Map<number, Complaint>();
    // Attendance complaints only: a grade complaint on a session mark names the session too.
    for (const c of q.data ?? []) if (c.type === 'attendance' && c.session_instance_id && !m.has(c.session_instance_id)) m.set(c.session_instance_id, c);
    return m;
  }, [q.data]);
  const byInvoice = useMemo(() => {
    const m = new Map<number, Complaint>();
    for (const c of q.data ?? []) if (c.type === 'payment' && c.invoice_id && !m.has(c.invoice_id)) m.set(c.invoice_id, c);
    return m;
  }, [q.data]);
  return { ...q, bySession, byInvoice };
}

export function useFileComplaint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fileComplaint,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-complaints'] }); },
  });
}

/**
 * «اعتراض على الدرجة». The grade rows carry their own complaint state, so a filing
 * refreshes the marks and exam lists (student and parent) as well as the complaint list.
 */
export function useFileGradeComplaint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fileGradeComplaint,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-complaints'] });
      qc.invalidateQueries({ queryKey: ['grades'] });
      qc.invalidateQueries({ queryKey: ['exam-results'] });
      qc.invalidateQueries({ queryKey: ['reports', 'grades'] });
      qc.invalidateQueries({ queryKey: ['student-teacher-detail'] });
    },
  });
}

// ---- teacher / assistant ----

export function useComplaints(bucket: ComplaintBucket, enabled = true) {
  return useQuery({ queryKey: ['complaints', bucket], queryFn: () => getComplaints(bucket), enabled, staleTime: 15_000 });
}

/** Approve / reject / review, each refreshing every bucket and what the decision touched. */
export function useComplaintDecision() {
  const qc = useQueryClient();
  const after = () => {
    qc.invalidateQueries({ queryKey: ['complaints'] });
    qc.invalidateQueries({ queryKey: ['review-summary'] });
    qc.invalidateQueries({ queryKey: ['assistant-actions'] });
    qc.invalidateQueries({ queryKey: ['teacher-student'] });
    qc.invalidateQueries({ queryKey: ['teacher-session-detail'] });
    qc.invalidateQueries({ queryKey: ['teacher-insights'] });
    // An approved grade complaint rewrites a session mark or a merged-exam mark.
    qc.invalidateQueries({ queryKey: ['revision-attendees'] });
  };
  const approve = useMutation({ mutationFn: ({ id, ...input }: { id: number } & ApproveInput) => approveComplaint(id, input), onSuccess: after });
  const reject = useMutation({ mutationFn: ({ id, note }: { id: number; note?: string }) => rejectComplaint(id, note), onSuccess: after });
  const review = useMutation({ mutationFn: (id: number) => reviewComplaint(id), onSuccess: after });
  return { approve, reject, review };
}
