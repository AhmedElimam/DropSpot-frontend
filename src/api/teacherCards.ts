import client from '@/api/client';

/**
 * «كارت المدرّس» — blank cards printed for one teacher, claimed to a student at the door
 * (backend docs/TEACHER_CARDS.md). Every rule is on the server; these are thin calls.
 */
export type TeacherCardState = 'pending_delivery' | 'unclaimed' | 'active' | 'revoked_by_master' | 'revoked' | 'expired';

export interface TeacherCardBatch {
  id: number;
  quantity: number;
  status: 'pending_delivery' | 'delivered';
  expires_at: string | null;
  delivered_at: string | null;
  created_at: string | null;
  counts: Partial<Record<TeacherCardState, number>>;
}

export interface TeacherCardsOverview {
  can_claim: boolean;
  can_confirm: boolean;
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

export async function claimTeacherCard(cardCode: string, studentId: number, replaceLost = false): Promise<string> {
  const { data } = await client.post('/teacher/teacher-cards/claim', { card_code: cardCode, student_id: studentId, replace_lost: replaceLost });
  return String(data.message ?? '');
}

export async function unclaimTeacherCard(cardId: number): Promise<string> {
  const { data } = await client.post(`/teacher/teacher-cards/${cardId}/unclaim`);
  return String(data.message ?? '');
}

export async function revokeTeacherCard(cardId: number, reason: string): Promise<string> {
  const { data } = await client.post(`/teacher/teacher-cards/${cardId}/revoke`, { reason });
  return String(data.message ?? '');
}
