import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { QuizRunner } from '@/components/quiz/QuizRunner';

export default function StudentQuizScreen() {
  const params = useLocalSearchParams<{ quizId: string }>();
  const user = useAuthStore((s) => s.user);
  const studentId = user?.student_id ?? 0;

  return (
    <QuizRunner
      quizId={parseInt(params.quizId ?? '0', 10)}
      studentId={studentId}
    />
  );
}
