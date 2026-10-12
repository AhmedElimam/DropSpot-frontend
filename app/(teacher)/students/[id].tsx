import { useLocalSearchParams } from 'expo-router';
import { StudentProfile } from '@/components/teacher/StudentProfile';
import { Surface } from '@/ui/surfaces';

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Surface id="screen.teacher.students.detail" screen>
      <Surface id="teacher.students.detail.profile"><StudentProfile id={id} /></Surface>
    </Surface>
  );
}
