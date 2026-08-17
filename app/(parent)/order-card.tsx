import { useLocalSearchParams } from 'expo-router';
import { CardOrderForm } from '@/components/cardOrder/CardOrderForm';

/** Parent order-a-card-for-a-child screen (routed from the homepage banner). */
export default function ParentOrderCard() {
  const { studentId } = useLocalSearchParams<{ studentId?: string }>();
  return <CardOrderForm preselectStudentId={studentId ? Number(studentId) : undefined} />;
}
