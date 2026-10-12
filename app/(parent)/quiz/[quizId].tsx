import { useLocalSearchParams } from 'expo-router';
import { QuizRunner } from '@/components/quiz/QuizRunner';
import { Surface } from '@/ui/surfaces';

export default function ParentQuizScreen() {
  const params = useLocalSearchParams<{ quizId: string; studentId: string }>();
  return (
    <Surface id="screen.parent.quiz.detail" screen>
    <QuizRunner
      quizId={parseInt(params.quizId ?? '0', 10)}
      studentId={parseInt(params.studentId ?? '0', 10)}
    />
    </Surface>
  );
}
