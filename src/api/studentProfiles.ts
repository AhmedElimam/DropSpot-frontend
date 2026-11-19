import client from './client';
import { extractAttrs } from './utils';
import type { AuthResponse, StudentProfileEntry } from '@/types/user';

/** The students who sign in from this phone (siblings sharing one number). */
export async function getStudentProfiles(): Promise<StudentProfileEntry[]> {
  const { data } = await client.get('/student/profiles');
  const list = data?.data?.profiles ?? data?.profiles;

  return Array.isArray(list) ? (list as StudentProfileEntry[]) : [];
}

/**
 * Switch the phone to a sibling. Answers exactly like a login (user + tokens + role) for the
 * target, parsed the same way `login()` parses it. 403 PROFILE_NOT_SHARED when the target is
 * not on this phone.
 */
export async function switchStudentProfile(userId: number): Promise<AuthResponse> {
  const { data } = await client.post(`/student/profiles/${userId}/switch`);

  return extractAttrs(data.data ?? data);
}
