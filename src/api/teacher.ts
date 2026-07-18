import client from './client';
import { extractList, extractAttrs } from './utils';

export interface CheckinPermission {
  id: number;
  student_id: number;
  student_name: string | null;
  course_name: string | null;
  reason: string;
  note: string | null;
  expires_at: string | null;
  granted_by_name: string | null;
}

export interface BillingOverride {
  id: number;
  student_id: number;
  student_name: string | null;
  granted_at: string | null;
  expires_at: string | null;
  reason: string | null;
  granted_by_name: string | null;
}

export interface StudentHit {
  id: string;
  name: string;
  subtitle?: string;
}

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

// ---- Overrides: check-in permissions ----

export async function getCheckinPermissions(): Promise<CheckinPermission[]> {
  const { data } = await client.get('/checkin-permissions');
  return extractList(data, 'checkin-permission').map((item: any) => {
    const attrs = extractAttrs(item);
    return { id: Number(item.id ?? attrs.id), ...attrs } as CheckinPermission;
  });
}

export async function revokeCheckinPermission(id: number): Promise<void> {
  await client.delete(`/checkin-permissions/${id}`);
}

// ---- Overrides: billing overrides ----

export async function getBillingOverrides(): Promise<BillingOverride[]> {
  const { data } = await client.get('/billing-overrides');
  return extractList(data, 'billing-override').map((item: any) => {
    const attrs = extractAttrs(item);
    return { id: Number(item.id ?? attrs.id), ...attrs } as BillingOverride;
  });
}

export async function grantBillingOverride(payload: {
  student_id: number;
  reason?: string;
}): Promise<void> {
  await client.post('/billing-overrides', payload);
}

export async function revokeBillingOverride(id: number): Promise<void> {
  await client.delete(`/billing-overrides/${id}`);
}

// Student picker for the grant flow — reuses the tenant-scoped /search endpoint.
export async function searchStudents(q: string): Promise<StudentHit[]> {
  const { data } = await client.get('/search', { params: { q } });
  return extractList(data, 'search')
    .map((item: any) => {
      const attrs = extractAttrs(item);
      return { ...attrs, id: String(item.id ?? attrs.id) };
    })
    .filter((r: any) => r.type === 'student')
    .map((r: any) => ({ id: r.id, name: r.name, subtitle: r.subtitle }));
}
