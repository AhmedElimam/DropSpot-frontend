import client from './client';

/**
 * Per-teacher revision / special-session switch. Reachable by the teacher AND
 * their assistant — both act on the same teacher-level flag (resolved server-side
 * from the active-teacher context). Gates the special/exam-session entry on mobile.
 */

export async function getReviseMode(): Promise<boolean> {
  // Fail OPEN: special/exam sessions are a normal-mode feature (default on). If the
  // endpoint is missing (backend not yet migrated) or the call errors, keep the
  // tools visible — only an explicit `false` from the server hides them.
  try {
    const { data } = await client.get('/teacher/revise-mode');
    return data?.data?.enabled !== false;
  } catch {
    return true;
  }
}

export async function setReviseMode(enabled: boolean): Promise<boolean> {
  const { data } = await client.post('/teacher/revise-mode', { enabled });
  return Boolean(data?.data?.enabled);
}
