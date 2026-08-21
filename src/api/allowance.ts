import client from './client';

/**
 * The 15-day billing-allowance controls: a teacher-wide switch and a per-student
 * block. Mirrors the web config; the grant endpoint itself refuses (with a fixed
 * message) when either gate is off. See AllowancePolicy on the backend.
 */

export async function getAllowanceSetting(): Promise<{ enabled: boolean }> {
  const { data } = await client.get('/teacher/allowance-setting');
  return (data.data ?? data) as { enabled: boolean };
}

export async function setAllowanceSetting(enabled: boolean): Promise<{ enabled: boolean }> {
  const { data } = await client.post('/teacher/allowance-setting', { enabled });
  return (data.data ?? data) as { enabled: boolean };
}

export async function setStudentAllowanceBlock(studentId: number, blocked: boolean): Promise<{ blocked: boolean }> {
  const { data } = await client.post(`/teacher/students/${studentId}/allowance-block`, { blocked });
  return (data.data ?? data) as { blocked: boolean };
}
