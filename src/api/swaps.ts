import client from './client';
import { extractList, extractAttrs } from './utils';

export interface SwapCandidate {
  id: number;
  scheduled_at: string;
  course_name?: string | null;
  teacher_name?: string | null;
  location?: string | null;
  session_schedule_id?: number | null;
  remaining_capacity: number | null;
}

/**
 * Eligible makeup sessions for a session the student will miss. Same-term
 * candidates (same course preferred, other courses as fallback) with room.
 */
export async function getSwapCandidates(
  studentId: number,
  originalSessionInstanceId: number,
): Promise<SwapCandidate[]> {
  const { data } = await client.get('/session-swaps/candidates', {
    params: { student_id: studentId, original_session_instance_id: originalSessionInstanceId },
  });
  return extractList(data, 'session-swap-candidate').map((item: any) => {
    const a = extractAttrs(item);
    return {
      id: parseInt(item.id, 10),
      scheduled_at: a.scheduled_at,
      course_name: a.course_name ?? null,
      teacher_name: a.teacher_name ?? null,
      location: a.location ?? null,
      session_schedule_id: a.session_schedule_id ?? null,
      remaining_capacity: a.remaining_capacity ?? null,
    };
  });
}

/**
 * Request a one-time swap. Creates a PENDING request — a teacher must approve it
 * before it takes effect; nothing is applied automatically.
 */
export async function requestSwap(payload: {
  student_id: number;
  target_session_instance_id: number;
  original_session_instance_id: number;
}): Promise<void> {
  await client.post('/session-swaps', payload);
}
