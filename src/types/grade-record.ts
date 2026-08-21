/** One per-session SHEET mark (درجة الشريحة) for the parent/student "الدرجات" tab. */
export interface GradeRecord {
  id: number;
  course_name: string | null;
  teacher_name?: string | null;
  /** The session's scheduled date (ISO), so marks in the same course are distinguishable. */
  date: string | null;
  /** The recorded mark. */
  score: number | null;
  /** The effective sheet max (session override, else course default); null if unset. */
  max_score: number | null;
  percentage: number;
}
