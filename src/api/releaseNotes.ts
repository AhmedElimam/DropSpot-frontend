import client from './client';

/** One release's «ما الجديد», already in this user's role's words (written at /admin/release-notes). */
export interface ReleaseNote {
  version: string;
  title: string | null;
  lines: string[];
  published_at: string | null;
}

/** Published notes for the caller's role, newest version first. Drafts never appear. */
export async function getReleaseNotes(): Promise<ReleaseNote[]> {
  const { data } = await client.get('/release-notes');
  return ((data?.data ?? data)?.notes ?? []) as ReleaseNote[];
}
