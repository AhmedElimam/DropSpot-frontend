import { useLocalSearchParams } from 'expo-router';
import { CardOrderForm } from '@/components/cardOrder/CardOrderForm';
import { Surface } from '@/ui/surfaces';

/** Student self-order card screen (routed from the homepage banner). */
export default function StudentOrderCard() {
  const { studentId } = useLocalSearchParams<{ studentId?: string }>();
  return <Surface id="screen.student.order-card" screen><CardOrderForm preselectStudentId={studentId ? Number(studentId) : undefined} /></Surface>;
}
