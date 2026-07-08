import client from './client';
import { extractList, extractAttrs } from './utils';
import type { Quiz, QuizAttempt, Question } from '@/types/quiz';

export async function getQuizzes(studentId: number): Promise<Quiz[]> {
  const { data } = await client.get(`/students/${studentId}/quizzes`);
  return extractList(data, 'quizzes').map(extractQuiz);
}

export async function getQuizWithQuestions(id: number): Promise<{ quiz: Quiz; questions: Question[] }> {
  const { data } = await client.get(`/quizzes/${id}`);
  const attrs = extractAttrs(data.data ?? data);
  return {
    quiz: extractQuiz(data.data ?? data),
    questions: (attrs.questions ?? []).map((q: any) => ({
      id: q.id,
      text: q.text,
      type: q.type as Question['type'],
      options: q.options?.choices ?? null,
      points: q.points,
      order: q.order,
    })),
  };
}

export async function startAttempt(quizId: number, studentId: number): Promise<QuizAttempt> {
  const { data } = await client.post(`/quiz-attempts`, { quiz_id: quizId, student_id: studentId, action: 'start' });
  return extractAttrs(data.data ?? data);
}

export async function submitAttempt(
  attemptId: number,
  answers: Record<string, string | string[]>
): Promise<QuizAttempt> {
  const { data } = await client.put(`/quiz-attempts/${attemptId}`, { answers, action: 'submit' });
  return extractAttrs(data.data ?? data);
}

function extractQuiz(item: any): Quiz {
  const a = extractAttrs(item);
  return {
    id: parseInt(item.id, 10),
    title: a.title,
    description: a.description,
    duration_minutes: a.duration_minutes,
    passing_score: a.passing_score,
    max_score: a.max_score,
    is_active: a.is_active,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    question_count: a.question_count,
    course_name: a.course_name,
  };
}
