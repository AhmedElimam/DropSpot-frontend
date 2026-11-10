import { useLocalSearchParams } from 'expo-router';
import { useChildren } from '@/hooks/useChildren';
import { FamilyTeacherScreen } from '@/components/teacher/FamilyTeacherScreen';

/**
 * One teacher, for one child (founder 2026-11-10): the same page the student reads — courses,
 * next sessions, marks, exams, and the record with each session's note and homework.
 */
export default function ParentTeacherPage() {
  const { id, student_id } = useLocalSearchParams<{ id: string; student_id?: string }>();
  const { data: children } = useChildren();
  const studentId = student_id ? Number(student_id) : null;
  const child = (children ?? []).find((c) => Number(c.student_id) === studentId);
  return <FamilyTeacherScreen studentId={studentId} teacherId={Number(id)} who="parent" childName={child?.name ?? null} />;
}
