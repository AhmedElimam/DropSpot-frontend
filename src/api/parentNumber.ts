import client from './client';

/** A student proves their parent's number: a code goes to the parent, who reads it to them. */
export async function sendParentNumberCode(): Promise<{ sent?: boolean; checked?: boolean; parent_phone_hint?: string | null }> {
  const { data } = await client.post('/student/parent-number/send');
  return data.data;
}

export async function verifyParentNumberCode(code: string): Promise<{ checked: boolean }> {
  const { data } = await client.post('/student/parent-number/verify', { code });
  return data.data;
}
