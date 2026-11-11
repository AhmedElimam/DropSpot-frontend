import { useLocalSearchParams } from 'expo-router';
import { HomeworkScreen } from '@/components/homework/HomeworkScreen';
import { useChildren } from '@/hooks/useChildren';

/** «الواجبات» for a parent — every child, or the one a notification or link names. */
export default function ParentHomework() {
  const { student_id } = useLocalSearchParams<{ student_id?: string }>();
  const { data: children } = useChildren();
  return <HomeworkScreen who="parent" family={(children ?? []).map((c) => ({ student_id: c.student_id, name: c.name }))} initialStudentId={student_id ?? null} />;
}
