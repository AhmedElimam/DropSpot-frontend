import client from './client';

/**
 * Deferred verification wall for the student's OWN number. A daily server sweep flags
 * students whose own number is still unverified 24h+ after registering; the app
 * hard-blocks on `user.needs_own_number_verification` until this loop succeeds.
 *
 *  - send   → OTP to the number on file.
 *  - verify → correct code clears the wall.
 *  - change → corrects a wrong number AND sends a fresh OTP; the wall stays up until
 *             that number is verified (re-typing a different number never dismisses it).
 */

export async function sendOwnNumberOtp(): Promise<{ masked_phone: string }> {
  const { data } = await client.post('/student/own-number/send-otp');
  return data.data ?? data;
}

export async function verifyOwnNumber(code: string): Promise<void> {
  await client.post('/student/own-number/verify', { code });
}

export async function changeOwnNumber(phone_number: string): Promise<{ masked_phone: string }> {
  const { data } = await client.post('/student/own-number/change', { phone_number });
  return data.data ?? data;
}
