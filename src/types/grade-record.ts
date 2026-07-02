export interface GradeRecord {
  id: number;
  quiz_id: number;
  quiz_title: string | null;
  course_name: string | null;
  score: number | null;
  max_score: number;
  percentage: number;
  passed: boolean | null;
  submitted_at: string;
}
