import client from './client';
import { extractList, extractAttrs } from './utils';

export interface ExamResult {
  date?: string | null;
  title?: string | null;
  mark?: number | null;
  max?: number | null;
  pct?: number | null;
  source?: 'session' | 'revision';
}

export interface ReportCard {
  id: string;
  student_id: string;
  student_name?: string;
  course_name?: string;
  teacher_name?: string;
  period_start?: string;
  period_end?: string;
  sessions_total?: number;
  present_count?: number;
  late_count?: number;
  absent_count?: number;
  excused_count?: number;
  academic_score?: number | string | null;
  attendance_score?: number | string | null;
  overall_score?: number | string | null;
  letter_grade?: string | null;
  /** §1/§2 — big-exam results, separate from the academic average. */
  exam_results?: ExamResult[];
  generated_at?: string;
}

/** Parent: periodic report cards across all of the parent's children (newest first). */
export async function getReportCards(): Promise<ReportCard[]> {
  const { data } = await client.get('/parents/reports');
  return extractList(data, 'reports').map((item: any) => {
    const attrs = extractAttrs(item);
    return { id: item.id, ...attrs };
  });
}

/**
 * Mint a short-lived SIGNED URL for a report's PDF. The backend authenticates the
 * owner here (Bearer) and returns a 5-minute signed link the device's external
 * browser can open directly — the browser can't carry the app's token, so the
 * signature is what authorizes the download.
 */
export async function getReportDownloadUrl(reportId: string): Promise<string> {
  const { data } = await client.get(`/parents/reports/${reportId}/download-url`);
  return data?.data?.url ?? data?.url;
}
