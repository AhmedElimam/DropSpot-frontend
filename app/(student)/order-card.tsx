import { useLocalSearchParams } from 'expo-router';
import { CardOrderForm } from '@/components/cardOrder/CardOrderForm';

/** Student self-order card screen (routed from the homepage banner). */
export default function StudentOrderCard() {
  const { studentId } = useLocalSearchParams<{ studentId?: string }>();
  return <CardOrderForm preselectStudentId={studentId ? Number(studentId) : undefined} />;
}
