import client from './client';

/**
 * Self-service parent phone change — a real re-verification (double OTP), not a timer.
 * Step 1 sends a code to the CURRENT number; step 3 sends one to the NEW number; the
 * number only updates after both are proven. A parent who lost their old number uses
 * the assisted (teacher → super-admin) correction path instead.
 */

export async function startPhoneChange(): Promise<{ masked_old_phone: string }> {
  const { data } = await client.post('/parents/phone-change/start');
  return (data.data ?? {}) as { masked_old_phone: string };
}

export async function verifyOldPhone(code: string): Promise<void> {
  await client.post('/parents/phone-change/verify-old', { code });
}

export async function requestNewPhone(newPhone: string): Promise<{ masked_new_phone: string }> {
  const { data } = await client.post('/parents/phone-change/request-new', { new_phone: newPhone });
  return (data.data ?? {}) as { masked_new_phone: string };
}

export async function confirmPhoneChange(code: string): Promise<{ phone: string }> {
  const { data } = await client.post('/parents/phone-change/confirm', { code });
  return (data.data ?? {}) as { phone: string };
}
