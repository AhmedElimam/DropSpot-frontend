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

/** Passive "has pending" flags shown after a successful scan (non-interactive). */
export interface ScanPending {
  bill: { total: number; count: number; overdue: boolean; escalated?: boolean; paid?: number; partial?: boolean } | null;
  booklets: { id: number; course: string | null; amount: number; paid?: number; partial?: boolean }[];
  booking: { total: number; count: number; secures?: string; paid?: number } | null;
}

export interface ScanResult {
  success: boolean;
  message: string;
  student_name: string | null;
  // Machine code (e.g. 'BILLING_OVERDUE') + resolved student id — used to single
  // out an overdue block and offer the in-the-moment 15-day exemption.
  code?: string | null;
  student_id?: number | null;
  // Passive flags for the scanned student (bill / booklet / booking down-payment).
  pending?: ScanPending | null;
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
      code: data.code ?? null,
      student_id: data.student_id ?? null,
      pending: data.pending ?? null,
    };
  } catch (e: any) {
    // Non-2xx failures (expired card, not enrolled, overdue block, etc.) carry the same shape.
    const d = e?.response?.data;
    if (d) {
      return {
        success: false,
        message: d.message ?? '',
        student_name: d.student_name ?? null,
        code: d.code ?? null,
        student_id: d.student_id ?? null,
        // The overdue block carries the dues so the app can open the collect modal.
        pending: d.pending ?? null,
      };
    }
    throw e;
  }
}

/**
 * Grant a 15-day billing exemption in the moment at the door (no PIN — teacher OR
 * assistant), then the server re-runs the scan and checks the student in. Returns
 * the resulting check-in outcome.
 */
export async function grantDoorExemption(cardCode: string): Promise<ScanResult> {
  try {
    const { data } = await client.post('/checkin/billing-override', {
      card_code: cardCode,
      scan_source: 'app_camera',
    });
    return {
      success: !!data.success,
      message: data.message ?? '',
      student_name: data.student_name ?? null,
      code: data.code ?? null,
      student_id: data.student_id ?? null,
    };
  } catch (e: any) {
    const d = e?.response?.data;
    if (d) {
      return { success: false, message: d.message ?? '', student_name: d.student_name ?? null, code: d.code ?? null };
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

// ---- Offline reconciliation ----

export interface OfflineScanResult {
  card_code: string;
  outcome: 'synced' | 'already_recorded' | 'failed';
  code: string | null;
  message: string;
  student_name: string | null;
}

export interface OfflineBatchResponse {
  session_instance_id: number;
  synced: number;
  total: number;
  results: OfflineScanResult[];
}

/**
 * Submit a bucket of buffered scans against an explicit session. Each scan
 * carries its original scanned_at (backend validates the window against it, not
 * sync time). Returns per-scan outcomes so the caller deletes what's safely on
 * the server (synced/already_recorded) and keeps/surfaces failures.
 */
export async function syncOfflineBatch(
  sessionInstanceId: number,
  scans: { card_code: string; scanned_at: string }[],
  expectedTeacherId?: number | null,
): Promise<OfflineBatchResponse> {
  const { data } = await client.post('/checkin/offline-batch', {
    session_instance_id: sessionInstanceId,
    scans,
    // The scan-time teacher stamp; the server refuses (CONTEXT_MISMATCH) if the
    // chosen session belongs to a different teacher, so a switched context can
    // never misfile a batch scanned for someone else (§4).
    ...(expectedTeacherId ? { expected_teacher_id: expectedTeacherId } : {}),
  });
  return (data.data ?? data) as OfflineBatchResponse;
}

export interface AssistantTeacher {
  teacher_id: number;
  name: string | null;
  abilities: string[];
  is_active_context: boolean;
}

/** Teachers this assistant works for + which is the active context on this token. */
export async function getMyTeachers(): Promise<{ active_teacher_id: number | null; teachers: AssistantTeacher[] }> {
  const { data } = await client.get('/auth/my-teachers');
  return (data.data ?? data) as { active_teacher_id: number | null; teachers: AssistantTeacher[] };
}

/** Atomically switch the active teacher context on the current token. */
export async function switchActiveTeacher(teacherId: number): Promise<{ active_teacher_id: number }> {
  const { data } = await client.post('/auth/switch-teacher', { teacher_id: teacherId });
  return (data.data ?? data) as { active_teacher_id: number };
}
