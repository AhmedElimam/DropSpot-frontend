import { useLocalSearchParams } from 'expo-router';
import { StudentProfile } from '@/components/teacher/StudentProfile';

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StudentProfile id={id} />;
}
