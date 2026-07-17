import client from './client';
import { extractList, extractAttrs } from './utils';

export interface TeacherSession {
  id: string;
  course_name: string | null;
  scheduled_at: string | null;
  time: string | null;
  duration_minutes: number | null;
  location: string | null;
  status: string;
  is_current: boolean;
}

export async function getTeacherTodaySessions(): Promise<TeacherSession[]> {
  const { data } = await client.get('/teacher/sessions/today');
  return extractList(data, 'teacher-session').map((item: any) => {
    const attrs = extractAttrs(item);
    return { id: item.id ?? attrs.id, ...attrs } as TeacherSession;
  });
}

export interface ScanResult {
  success: boolean;
  message: string;
  student_name: string | null;
}

/**
 * Scan a student card via the shared kiosk endpoint. Marks the source as
 * app_camera. The backend resolves the student's current session from the card
 * and runs all the usual validation — this is just a new client.
 */
export async function scanCard(cardCode: string): Promise<ScanResult> {
  try {
    const { data } = await client.post('/checkin/scan', {
      card_code: cardCode,
      scan_source: 'app_camera',
    });
    return {
      success: !!data.success,
      message: data.message ?? '',
      student_name: data.student_name ?? null,
    };
  } catch (e: any) {
    // Non-2xx failures (expired card, not enrolled, etc.) carry the same shape.
    const d = e?.response?.data;
    if (d) {
      return { success: false, message: d.message ?? '', student_name: d.student_name ?? null };
    }
    throw e;
  }
}
