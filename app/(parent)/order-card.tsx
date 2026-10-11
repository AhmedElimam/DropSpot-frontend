import { useLocalSearchParams } from 'expo-router';
import { CardOrderForm } from '@/components/cardOrder/CardOrderForm';
import { Surface } from '@/ui/surfaces';

/** Parent order-a-card-for-a-child screen (routed from the homepage banner). */
export default function ParentOrderCard() {
  const { studentId } = useLocalSearchParams<{ studentId?: string }>();
  return <Surface id="screen.parent.order-card" screen><CardOrderForm preselectStudentId={studentId ? Number(studentId) : undefined} /></Surface>;
}
