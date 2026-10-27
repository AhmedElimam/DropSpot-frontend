import client from './client';

/** A student proves their parent's number: a code goes to the parent, who reads it to them. */
export async function sendParentNumberCode(): Promise<{ sent?: boolean; checked?: boolean; parent_phone_hint?: string | null }> {
  const { data } = await client.post('/student/parent-number/send');
  return data.data;
}

/** A student's request to a teacher to correct the parent's number, as the lock screen shows it. */
export interface ParentNumberRequest {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  teacher_name: string | null;
  proposed_hint: string | null;
  rejection_reason: string | null;
}

export interface ParentNumberState {
  needs: boolean;
  parent_phone_hint: string | null;
  request: ParentNumberRequest | null;
}

/** The lock screen's state: still to prove, the number's hint, and any request to a teacher. */
export async function getParentNumberState(): Promise<ParentNumberState> {
  const { data } = await client.get('/student/parent-number');
  return data.data;
}

/** «ده مش رقم ولي أمري»: ask one of your teachers to correct it (their OK applies it). */
export async function requestParentNumberChange(payload: { teacher_id: number; phone: string; note?: string }): Promise<{ request: ParentNumberRequest | null }> {
  const { data } = await client.post('/student/parent-number/request', payload);
  return data.data;
}

export async function verifyParentNumberCode(code: string): Promise<{ checked: boolean }> {
  const { data } = await client.post('/student/parent-number/verify', { code });
  return data.data;
}
