import client from './client';
import { extractAttrs } from './utils';
import type { AuthResponse } from '@/types/user';

/**
 * Mobile impersonation (super-admin support tool). The web dashboard mints a
 * one-time ticket shown as a QR / drosspot://impersonate/{ticket} deep link; the
 * app redeems it here for a short-lived impersonation session. No refresh token is
 * issued — the session simply expires (fail-closed) and can't be silently extended.
 */
export interface ImpersonationExchange extends Omit<AuthResponse, 'tokens'> {
  tokens: { access_token: string; refresh_token: string | null };
  impersonation: { active: boolean; name: string; write: boolean };
}

export async function exchangeImpersonation(ticket: string): Promise<ImpersonationExchange> {
  const { data } = await client.post('/impersonation/exchange', { ticket });
  return extractAttrs(data.data ?? data);
}

export async function stopImpersonation(): Promise<void> {
  await client.post('/impersonation/stop');
}

/** Toggle write mode server-side (refused for student targets). */
export async function setImpersonationWrite(enable: boolean): Promise<void> {
  await client.post(enable ? '/impersonation/write' : '/impersonation/read');
}

export type ImpersonatableRole = 'teacher' | 'assistant' | 'parent' | 'student';

export interface ImpersonatableUser {
  id: number;
  name: string;
  phone: string | null;
}

/** In-app super-admin picker: list impersonatable users of one role, optional search. */
export async function listImpersonatableUsers(role: ImpersonatableRole, q: string): Promise<ImpersonatableUser[]> {
  const { data } = await client.get('/admin/impersonation/users', { params: { role, q: q || undefined } });
  return data.data ?? [];
}

/** Start impersonation directly by user id (super-admin), returning the session. */
export async function startImpersonationForUser(userId: number, write: boolean): Promise<ImpersonationExchange> {
  const { data } = await client.post('/admin/impersonation/start', { user_id: userId, write });
  return extractAttrs(data.data ?? data);
}
