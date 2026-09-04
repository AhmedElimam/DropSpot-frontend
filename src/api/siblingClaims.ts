import client from './client';

/**
 * The sibling gate — a child was attached to THIS parent's number as their guardian.
 *
 * A student's own phone is unique on the platform, but a parent's number is shared
 * between siblings by design. That leaves one hole: a student can type a friend's
 * parent's number and be attached to a real family. So every child added to an
 * existing parent has to be acknowledged by that parent here.
 *
 * Denying is not a complaint — it tells every teacher the student attends that the
 * guardian number on file reaches nobody in that child's family.
 */
export interface SiblingClaim {
  id: number;
  student_id: number;
  student_name: string;
  grade: string | null;
  created_at: string | null;
}

export async function getPendingSiblingClaims(): Promise<SiblingClaim[]> {
  const { data } = await client.get('/parents/sibling-claims');
  return ((data.data ?? data).claims ?? []) as SiblingClaim[];
}

/** "Yes, this is my child." */
export async function confirmSiblingClaim(id: number): Promise<void> {
  await client.post(`/parents/sibling-claims/${id}/confirm`);
}

/** "No — this is not my child." Warns the teachers the student is enrolled with. */
export async function denySiblingClaim(id: number, note?: string): Promise<void> {
  await client.post(`/parents/sibling-claims/${id}/deny`, note ? { note } : {});
}
