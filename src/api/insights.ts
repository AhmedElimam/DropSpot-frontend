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
}

export async function getTeacherInsights(): Promise<TeacherInsights> {
  const { data } = await client.get('/teacher/insights');
  return (data.data ?? data) as TeacherInsights;
}
