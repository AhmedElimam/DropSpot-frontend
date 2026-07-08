import { useLocalSearchParams } from 'expo-router';
import { QuizRunner } from '@/components/quiz/QuizRunner';

export default function ParentQuizScreen() {
  const params = useLocalSearchParams<{ quizId: string; studentId: string }>();
  return (
    <QuizRunner
      quizId={parseInt(params.quizId ?? '0', 10)}
      studentId={parseInt(params.studentId ?? '0', 10)}
    />
  );
}
