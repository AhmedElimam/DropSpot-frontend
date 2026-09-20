import client from './client';

/**
 * Teacher insights — the mobile view of the web /insights page. The backend
 * (TeacherInsightsController) returns category buckets (attendance / absence /
 * financial / growth) computed by the same service the web dashboard uses.
 */

export interface TrendDay {
  label: string;
  present: number;
  late: number;
  absent: number;
}

export interface CourseRate {
  name: string;
  rate: number;
  total: number;
}

/** Which period the numbers cover. `custom` carries explicit dates. */
export type InsightsRangeKey = 'month' | 'last_month' | 'last30' | 'last90' | 'all' | 'custom';

export interface InsightsRange {
  key: InsightsRangeKey;
  from: string | null;
  to: string | null;
  label: string;
  all_time: boolean;
}

export interface InsightsRangeParams {
  range?: InsightsRangeKey;
  from?: string;
  to?: string;
}

export interface TeacherInsights {
  attendance: {
    rate: number;
    on_time_rate: number;
    present: number;
    late: number;
    active_students: number;
    sessions_held: number;
    trend: TrendDay[];
    trend_max: number;
    per_course: CourseRate[];
  };
  absence: {
    absent: number;
    at_risk: number;
    termination_candidates: number;
    dormant: number;
    top_at_risk: { name: string; rate: number }[];
  };
  financial: {
    /** Collected DURING the chosen period (outstanding/overdue are always "as of now"). */
    collected: number;
    collected_this_month: number;
    outstanding: number;
    overdue: number;
    overdue_count: number;
  };
  growth: {
    new_students: number;
    active_students: number;
  };
  quiz: { attempts: number; avg_pct: number; pass_rate: number };
  range: InsightsRange;
  presets: { key: InsightsRangeKey; label: string }[];
}

/**
 * A response that is not JSON arrives as a STRING, not an object — a dev server prepending a
 * PHP notice to the body, an HTML error page from a proxy, a captive portal. `data.data` is
 * then undefined, `?? data` hands the screen that string, and the screen dies on
 * `d.attendance.rate` — "cannot read property 'rate' of undefined" (founder 2026-09-20),
 * which reads like a data bug and is really a transport one.
 *
 * Both screens already handle "no insights": manage skips the block, the insights screen
 * shows its own empty state. They only needed to be TOLD. So a payload that is not shaped
 * like insights is a failed request, not a value to pass on.
 */
function assertInsights(payload: unknown): TeacherInsights {
  const ok = !!payload
    && typeof payload === 'object'
    && typeof (payload as TeacherInsights).attendance === 'object'
    && (payload as TeacherInsights).attendance !== null;

  if (!ok) {
    throw new Error('insights: unexpected response shape');
  }

  return payload as TeacherInsights;
}

export async function getTeacherInsights(params: InsightsRangeParams = {}): Promise<TeacherInsights> {
  const { data } = await client.get('/teacher/insights', { params });
  return assertInsights(data?.data ?? data);
}

/**
 * A short-lived signed link to the PDF of exactly what the screen is showing. The teacher
 * and the period travel inside the signature, so the link cannot be edited into someone
 * else's numbers — which is why the app asks for a fresh one on every download.
 */
export async function getInsightsPdfUrl(params: InsightsRangeParams = {}): Promise<string> {
  const { data } = await client.get('/teacher/insights/pdf-url', { params });
  const url = (data?.data ?? data)?.url;
  // Same reasoning as assertInsights: a non-JSON body would otherwise be opened as a URL.
  if (typeof url !== 'string' || url === '') {
    throw new Error('insights: no pdf url in response');
  }

  return url;
}
