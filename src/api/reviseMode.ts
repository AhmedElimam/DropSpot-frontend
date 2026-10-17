import client from './client';

/**
 * Per-teacher revision / special-session switch. Reachable by the teacher AND
 * their assistant — both act on the same teacher-level flag (resolved server-side
 * from the active-teacher context). Gates the special/exam-session entry on mobile,
 * and since 2026-10-16 lays «وضع المراجعة» over the whole app (src/hooks/useRevisionTheme).
 *
 * The answer is the server's word, or nothing: a failed request leaves the query
 * without data (`undefined` = unknown). The gated entries fail OPEN on unknown
 * (`reviseOn !== false`), as before — but the season's theme needs an explicit
 * `true`, so a dropped request can never dress the app in indigo by accident.
 */

export async function getReviseMode(): Promise<boolean> {
  const { data } = await client.get('/teacher/revise-mode');
  return data?.data?.enabled === true;
}

export async function setReviseMode(enabled: boolean): Promise<boolean> {
  const { data } = await client.post('/teacher/revise-mode', { enabled });
  return Boolean(data?.data?.enabled);
}
