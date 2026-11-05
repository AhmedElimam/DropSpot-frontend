import client from '@/api/client';

/**
 * «كارت المدرّس» — blank cards printed for one teacher, claimed to a student at the door
 * (backend docs/TEACHER_CARDS.md). Every rule is on the server; these are thin calls.
 */
export type TeacherCardState = 'pending_delivery' | 'unclaimed' | 'active' | 'revoked_by_master' | 'revoked' | 'expired';

export interface TeacherCardBatch {
  id: number;
  quantity: number;
  /** requested / rejected: the teacher's own ask, before (or instead of) a batch with cards. */
  status: 'requested' | 'rejected' | 'pending_delivery' | 'delivered';
  status_label?: string;
  /** The admin's words on a declined request. */
  note?: string | null;
  expires_at: string | null;
  delivered_at: string | null;
  created_at: string | null;
  counts: Partial<Record<TeacherCardState, number>>;
}

export interface TeacherCardsOverview {
  can_claim: boolean;
  can_confirm: boolean;
  /** Teacher only, and no request already waiting. */
  can_request?: boolean;
  /** Teacher only: the print file leaves the platform. */
  can_print?: boolean;
  max_batch?: number;
  low_stock: boolean;
  totals: Record<TeacherCardState, number>;
  labels: Record<TeacherCardState, string>;
  revoke_reasons: Record<string, string>;
  batches: TeacherCardBatch[];
}

export interface TeacherCardRow {
  id: number;
  batch_id: number;
  seq: number;
  status: TeacherCardState;
  status_label: string;
  student: { id: number; name: string | null } | null;
  claimed_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  grace_used_at: string | null;
  expires_at: string | null;
  can_unclaim: boolean;
  can_revoke: boolean;
}

export interface TeacherCardPage {
  cards: TeacherCardRow[];
  page: number;
  last_page: number;
}

export async function getTeacherCards(): Promise<TeacherCardsOverview> {
  const { data } = await client.get('/teacher/teacher-cards');
  return data.data as TeacherCardsOverview;
}

export async function getTeacherCardBatch(batchId: number, page = 1, status?: TeacherCardState): Promise<TeacherCardPage> {
  const { data } = await client.get(`/teacher/teacher-cards/batches/${batchId}`, { params: { page, status } });
  return data.data as TeacherCardPage;
}

export async function confirmTeacherCardBatch(batchId: number): Promise<string> {
  const { data } = await client.post(`/teacher/teacher-cards/batches/${batchId}/confirm`);
  return String(data.message ?? '');
}

export async function lookupTeacherCard(cardCode: string): Promise<TeacherCardRow> {
  const { data } = await client.post('/teacher/teacher-cards/lookup', { card_code: cardCode });
  return data.data as TeacherCardRow;
}

/**
 * Link a blank to a student. With no connection the request is parked (src/api/offlineQueue.ts)
 * and replayed dated at this moment, so `queued` says the link is on the phone, not yet on the
 * server.
 */
export async function claimTeacherCard(cardCode: string, studentId: number, replaceLost = false): Promise<{ message: string; queued: boolean }> {
  const { data } = await client.post('/teacher/teacher-cards/claim', { card_code: cardCode, student_id: studentId, replace_lost: replaceLost });
  return { message: String(data.message ?? ''), queued: data?.queued === true };
}

/** «طلب دفعة كروت» — the teacher asks the platform for N blanks. */
export async function requestTeacherCardBatch(quantity: number): Promise<string> {
  const { data } = await client.post('/teacher/teacher-cards/request', { quantity });
  return String(data.message ?? '');
}

/** A 10-minute link to the batch's print file (teacher only, before the batch is confirmed). */
export async function getTeacherCardPrintUrl(batchId: number): Promise<{ url: string; filename: string }> {
  const { data } = await client.get(`/teacher/teacher-cards/batches/${batchId}/print-url`);
  return data.data as { url: string; filename: string };
}

/** The shape of a teacher-card token: 24 digits, bare or inside the card's /q# link. */
export function isTeacherCardToken(scanned: string): boolean {
  const m = /^https?:\/\/[^/\s]+\/q#(.+)$/i.exec(scanned.trim());
  const code = (m ? m[1] : scanned).trim();
  return /^\d{24}$/.test(code);
}

export async function unclaimTeacherCard(cardId: number): Promise<string> {
  const { data } = await client.post(`/teacher/teacher-cards/${cardId}/unclaim`);
  return String(data.message ?? '');
}

export async function revokeTeacherCard(cardId: number, reason: string): Promise<string> {
  const { data } = await client.post(`/teacher/teacher-cards/${cardId}/revoke`, { reason });
  return String(data.message ?? '');
}
