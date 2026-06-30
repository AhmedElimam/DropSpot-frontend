import client from './client';
import type { User, AuthTokens } from '@/types/user';

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post('/auth/login', { email, password });
  return data.data.attributes;
}

export async function refreshToken(refreshToken: string): Promise<AuthResponse> {
  const { data } = await client.post('/auth/refresh', { refresh_token: refreshToken });
  return data.data.attributes;
}

export async function logoutUser(deviceToken?: string): Promise<void> {
  await client.post('/auth/logout', { device_token: deviceToken });
}
