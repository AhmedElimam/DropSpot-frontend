import client from './client';

/**
 * The student's OWN number (2026-11-26). 24 hours after the first sign-in, a student whose
 * number is not proved is blocked (`user.needs_own_number_verification`).
 *
 *  - The student can only ask for one code on the number on file and type it in. They
 *    can't change the number.
 *  - Their teacher corrects the number if needed and proves it with a code on the spot.
 */

export async function sendOwnNumberOtp(): Promise<{ masked_phone: string }> {
  const { data } = await client.post('/student/own-number/send-otp');
  return data.data ?? data;
}

export async function verifyOwnNumber(code: string): Promise<void> {
  await client.post('/student/own-number/verify', { code });
}

/** Teacher: send a code to the student's number, or to a corrected one. */
export async function teacherSendStudentNumberCode(studentId: number, phone?: string): Promise<{ phone: string }> {
  const { data } = await client.post(`/teacher/students/${studentId}/own-number/send`, phone ? { phone } : {});
  return data.data ?? data;
}

/** Teacher: the code the student read out; the number is saved and proved. */
export async function teacherVerifyStudentNumber(studentId: number, code: string): Promise<{ phone: string; verified: boolean }> {
  const { data } = await client.post(`/teacher/students/${studentId}/own-number/verify`, { code });
  return data.data ?? data;
}
