import { useLocalSearchParams } from 'expo-router';
import { SessionNotesScreen } from '@/components/nazer/SessionNotesScreen';
import { useChildren } from '@/hooks/useChildren';

/** «ملاحظات الحصص» for a parent — every child, or the one a notification or link names. */
export default function ParentSessionNotes() {
  const { student_id } = useLocalSearchParams<{ student_id?: string }>();
  const { data: children } = useChildren();
  return <SessionNotesScreen who="parent" family={(children ?? []).map((c) => ({ student_id: c.student_id, name: c.name }))} initialStudentId={student_id ?? null} />;
}
