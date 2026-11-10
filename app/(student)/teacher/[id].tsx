import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { FamilyTeacherScreen } from '@/components/teacher/FamilyTeacherScreen';

/** One teacher, from the student's side — the screen is shared with the parent's. */
export default function StudentTeacherPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const studentId = useAuthStore((s) => s.user?.student_id ?? null);
  return <FamilyTeacherScreen studentId={studentId} teacherId={Number(id)} who="student" />;
}
