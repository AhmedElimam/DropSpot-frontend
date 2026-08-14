import client from './client';
import { extractList } from './utils';

/**
 * Resolution Center — the teacher's consolidated review queues (previously web-only):
 * absence excuses + session-swap requests, plus a needs-attention summary. Mirrors
 * the web pending-actions flows.
 */

export interface ResolutionSummary {
  excuses: number;
  swaps: number;
  tickets: number;
  total: number;
}

export interface ExcuseItem {
  id: number;
  student_name: string;
  course_name: string | null;
  reason: string | null;
  session_at: string | null;
  created_at: string | null;
}

export interface SwapItem {
  id: number;
  student_name: string;
  from_course: string | null;
  to_course: string | null;
  target_at: string | null;
  remaining: number | null;
  created_at: string | null;
}

export async function getResolutionSummary(): Promise<ResolutionSummary> {
  const { data } = await client.get('/teacher/resolution/summary');
  return (data.data ?? data) as ResolutionSummary;
}

export async function getPendingExcuses(): Promise<ExcuseItem[]> {
  const { data } = await client.get('/teacher/excuses');
  return extractList(data, 'absence-excuse').map((a: any) => ({ id: Number(a.id), ...a })) as ExcuseItem[];
}

export async function approveExcuse(id: number): Promise<void> {
  await client.post(`/teacher/excuses/${id}/approve`);
}

export async function rejectExcuse(id: number): Promise<void> {
  await client.post(`/teacher/excuses/${id}/reject`);
}

export async function getPendingSwaps(): Promise<SwapItem[]> {
  const { data } = await client.get('/teacher/session-swaps/pending');
  return extractList(data, 'session-swap').map((a: any) => ({ id: Number(a.id), ...a })) as SwapItem[];
}

export async function approveSwap(id: number): Promise<void> {
  await client.post(`/teacher/session-swaps/${id}/approve`);
}

export async function rejectSwap(id: number): Promise<void> {
  await client.post(`/teacher/session-swaps/${id}/reject`);
}
