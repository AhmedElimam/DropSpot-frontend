import client from '@/api/client';

/** «تصدير بياناتي»: the teacher's own data as Excel-ready CSV, or all of it in one ZIP. */
export type ExportDataset = 'students' | 'groups' | 'attendance' | 'bills' | 'expenses' | 'all';

/** A 10-minute signed link to one file, and its name. Teacher only. */
export async function getDataExportUrl(dataset: ExportDataset): Promise<{ url: string; filename: string }> {
  const { data } = await client.get('/teacher/data-export/url', { params: { dataset } });
  return data.data as { url: string; filename: string };
}
