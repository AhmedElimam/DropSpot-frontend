import client from './client';

/**
 * الناظر's stamped report (founder 2026-10-22): a 5-minute signed link to the PDF — the
 * browser that opens it carries no token. All the child's teachers in one report, with his
 * crest, the revision number and a credential to check at /v.
 */
export async function getChildReportUrl(studentId: string | number): Promise<string> {
  const { data } = await client.get(`/parents/children/${studentId}/report-url`);
  return (data?.data ?? data).url as string;
}

export async function getMyReportUrl(): Promise<string> {
  const { data } = await client.get('/students/report-url');
  return (data?.data ?? data).url as string;
}
