import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQuizzes, startAttempt, submitAttempt } from '@/api/quizzes';
import { useAuthStore } from '@/stores/authStore';

function useStudentId(): number {
  const user = useAuthStore((s) => s.user);
  return user?.student_id ?? 0;
}

export function useQuizzes() {
  const studentId = useStudentId();
  return useQuery({
    queryKey: ['quizzes', studentId],
    queryFn: () => getQuizzes(studentId),
    enabled: studentId > 0,
  });
}

export function useStartAttempt() {
  const studentId = useStudentId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (quizId: number) => startAttempt(quizId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
    },
  });
}

export function useSubmitAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ attemptId, answers }: { attemptId: number; answers: Record<string, string | string[]> }) =>
      submitAttempt(attemptId, answers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
    },
  });
}
