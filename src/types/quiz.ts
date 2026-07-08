export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer';

export interface Quiz {
  id: number;
  title: string;
  description: string | null;
  duration_minutes: number;
  passing_score: number;
  max_score: number;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  question_count: number;
  course_name?: string;
}

export interface Question {
  id: number;
  text: string;
  type: QuestionType;
  options: string[] | null;
  points: number;
  order: number;
}

export interface QuizAnswer {
  questionId: number;
  value: string | string[];
}

export interface QuizAttempt {
  id: number;
  quiz_id: number;
  student_id: number;
  score: number | null;
  max_score: number;
  passed: boolean | null;
  started_at: string;
  submitted_at: string | null;
  answers: Record<string, string | string[]> | null;
}
