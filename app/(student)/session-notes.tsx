import { SessionNotesScreen } from '@/components/nazer/SessionNotesScreen';

/** «ملاحظات الحصص» for a student — their own sessions. */
export default function StudentSessionNotes() {
  return <SessionNotesScreen who="student" />;
}
