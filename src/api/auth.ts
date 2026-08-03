import client from './client';
import { extractAttrs } from './utils';
import type { AuthResponse, RegisterResponse } from '@/types/user';

export async function login(phone_number: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post('/auth/login', { phone_number, password });
  return extractAttrs(data.data ?? data);
}

export async function refreshToken(refreshToken: string): Promise<AuthResponse> {
  const { data } = await client.post('/auth/refresh', { refresh_token: refreshToken });
  return extractAttrs(data.data ?? data);
}

export async function register(payload: {
  name: string;
  phone_number: string;
  parent_phone: string;
  parent_relation: string;
  parent_name: string;
}): Promise<RegisterResponse> {
  const { data } = await client.post('/auth/register', payload);
  return data;
}

export async function verifyOtp(phone: string, code: string, purpose = 'registration') {
  const { data } = await client.post('/auth/verify-otp', { phone, code, purpose });
  return data;
}

export interface ParentSetupInfo {
  name: string;
  phone_number: string;
  already_set: boolean;
}

/** First-time parent setup: read-only details (phone + name) for the token. */
export async function getParentSetup(token: string): Promise<ParentSetupInfo> {
  const { data } = await client.get(`/parent-setup/${token}`);
  return extractAttrs(data.data ?? data);
}

/** Set the parent's password via the setup token; returns a logged-in session. */
export async function setParentPassword(token: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post(`/parent-setup/${token}`, { password });
  return extractAttrs(data.data ?? data);
}
