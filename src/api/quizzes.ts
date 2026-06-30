import client from './client';
import type { Quiz, QuizAttempt } from '@/types/quiz';

export async function getQuizzes(studentId: number): Promise<Quiz[]> {
  const { data } = await client.get(`/students/${studentId}/quizzes`);
  return data.data?.map(extractQuiz) ?? [];
}

export async function getQuizById(id: number): Promise<Quiz> {
  const { data } = await client.get(`/quizzes/${id}`);
  return extractQuiz(data.data);
}

export async function startAttempt(quizId: number, studentId: number): Promise<QuizAttempt> {
  const { data } = await client.post(`/quiz-attempts`, { quiz_id: quizId, student_id: studentId, action: 'start' });
  return data.data.attributes;
}

export async function submitAttempt(
  attemptId: number,
  answers: Record<string, string | string[]>
): Promise<QuizAttempt> {
  const { data } = await client.put(`/quiz-attempts/${attemptId}`, { answers, action: 'submit' });
  return data.data.attributes;
}

function extractQuiz(item: any): Quiz {
  const a = item.attributes ?? item;
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
