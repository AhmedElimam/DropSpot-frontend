import client from './client';
import { extractAttrs } from './utils';
import type { AuthResponse } from '@/types/user';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post('/auth/login', { email, password });
  return extractAttrs(data.data ?? data);
}

export async function refreshToken(refreshToken: string): Promise<AuthResponse> {
  const { data } = await client.post('/auth/refresh', { refresh_token: refreshToken });
  return extractAttrs(data.data ?? data);
}
